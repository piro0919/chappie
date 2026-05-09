# Chappie

A hands-free voice AI assistant. Wake it with "**chappie**" (English) or "**チャッピー**" (Japanese) and have a fully voice-driven conversation, all from a tray-only desktop app.

## Tech Stack

- **Tauri v2** (Rust backend + WebView UI)
- **React 19 + Vite + TypeScript** (renderer)
- **pnpm** (package manager)
- **whisper-rs** (local STT, Metal-accelerated on macOS) — uses `ggml-small.bin`
- **cpal** (mic capture in Rust) + **rubato** (resampling) + **voice_activity_detector** (Silero VAD V5)
- **Multi-provider LLM** (OpenAI / Anthropic / Gemini). Provider auto-detected from the API key prefix; settings UI has no provider/model picker. HTTP call lives in Rust via `reqwest` so the key never enters the renderer. Each provider's cheapest tool-capable model is the default; `CHAPPIE_MODEL` env var overrides for power users.
- **Web Speech API `SpeechSynthesis`** (TTS) — voice auto-picked to match the resolved language; no UI picker.
- **i18n**: 9 languages (ja / en / es / fr / de / it / pt / ko / zh). Renderer-side catalog in `src/i18n/messages.ts`; Rust-side `i18n.rs` holds the app-wide language for tray / updater / capabilities.

## Architecture

### Rust Backend (`src-tauri/src/`)

- `lib.rs` — main: Builder, plugin registration, tray init, Tauri commands (`set_tray_state`, `open_settings`, `ensure_model`, mic permission, `start_listening`/`stop_listening`/`pause_listening`/`resume_listening`, `chat_complete`, `is_muted`, `hud_show`/`hud_dismiss`, `set_update_available`). Hides the Dock icon (`ActivationPolicy::Accessory`); blocks duplicate launches via `tauri-plugin-single-instance`. Hosts `run_whisper(audio: Vec<f32>) -> Result<String, String>` used by the in-process audio pipeline.
- `tray.rs` — menu-bar tray icon (5 states: idle/listening/thinking/speaking/error + a separate "off" icon when the user disables mic). Menu items: status, mic on/off check item, 設定を開く, アップデートを確認, 終了. Toggling mic off actually drops the cpal stream so macOS no longer reports Chappie as a mic-using app. Settings window comes to the front via `NSApp.activateIgnoringOtherApps:` since Accessory-mode apps don't auto-focus. Holds `UPDATE_AVAILABLE: AtomicBool` — the `timer.rs` ticker reads it to prefix the tray title with `🔔` until the next successful update.
- `updater.rs` — Rust-side auto-update flow using `tauri-plugin-updater` + `tauri-plugin-dialog`'s `blocking_show()` so the dialog is window-independent (JS `ask()` would attach to the hidden main window as a sheet). Three trigger types: `Launch` (startup, auto-prompts if update found), `Periodic` (6h background ticker, only flips the tray 🔔 badge — never interrupts), `Manual` (tray "アップデートを確認" menu, always shows result including "you're up to date"). Mirrors Galopen's pattern.
- `hud.rs` — runtime-built always-on-top transparent HUD window (label `hud`, frameless / mouse passthrough). `show(app, text, duration_ms)` repositions it bottom-center on the monitor under the cursor, then emits `hud:show` for the renderer to fade the message in/out. Used as the visual fallback whenever the audio channel is unreliable (system mute) or worth reinforcing (mute toggles, timer fires).
- `volume.rs` — system audio volume helpers via `osascript -e "set volume output volume N"` / `output muted`. Exposes `is_muted` Tauri command for the renderer to branch its TTS pipeline.
- `music.rs` — Spotify / Apple Music control via osascript (`playpause` / `next track` / `previous track`) and now-playing readout. Only acts on apps that are already running so a casual "play" never silently launches Spotify; auto mode prefers Spotify, falls back to Music.
- `clipboard.rs` — `arboard` wrapper for `read_clipboard` / `write_clipboard` tools.
- `screenshot.rs` — `screencapture(1)` wrapper for `take_screenshot`. `selection`/`fullscreen` × `clipboard`/`file (~/Desktop/Screenshot YYYY-MM-DD HH.MM.SS.png)`. Runs in `spawn_blocking` so interactive selection doesn't stall the runtime; cancellation (Esc) is detected by missing output file in file mode.
- `notes.rs` — voice memo store persisted to `~/.chappie/notes.json`. `add_note(text)` appends; `list_notes(query?, limit)` does case-fold substring filter, newest first; `delete_note(id)` removes. Lazy-loaded on first access. Embedding/RAG can layer on later if recall quality drives it.
- `memory.rs` — long-term memory store persisted to `~/.chappie/memory.json`. Distinct from `notes.rs`: notes are verbatim user-dictated text, memories are LLM-curated facts about the user (`profile` / `preference` / `episode` kinds). `save_memory(text, kind)` dedupes on case-fold equality; `recall_memory(query, limit)` scores entries by char-bigram overlap (handles JP without word breaks) plus a small recency bonus and bumps `last_recalled_at` so frequently-used entries float up; `list_memories(kind?, limit)` returns newest-first; `forget_memory(id)` removes. `profile_summary()` returns a short bullet list of profile + preference entries that gets injected as a `system` message in all 3 providers' chat_complete paths (after the persona prompt to keep the prompt-cache prefix stable). Episodes are NOT included in profile_summary — they surface only via `recall_memory` to keep the always-on prompt size bounded.
- `battery.rs` — parses `pmset -g batt` to surface percent / charging state / time-remaining / power source. Returns `has_battery=false` on desktop Macs without a battery.
- `power.rs` — `lock_screen` tool with three modes: `lock` (CGSession -suspend → login screen, system stays awake), `display_off` (`pmset displaysleepnow`), `sleep` (`pmset sleepnow`).
- `caffeinate.rs` — manages a child `caffeinate -d -i -m` process for `set_sleep_prevention` / `get_sleep_prevention`. Single global slot; calling `start` again replaces any existing one. Optional duration_minutes uses caffeinate's `-t`. Auto-cleared when the child exits (timer elapsed).
- `calendar.rs` — read-only macOS Calendar access via EventKit. Owns an `EKEventStore` on a dedicated OS thread (not Send/Sync) with mpsc command routing and `panic::catch_unwind` + `objc2::exception::catch` guards (same rule as `mic_permission.rs`). Exposes `list_events(range)` to the LLM with `today` / `tomorrow` / `upcoming` (next 7 days, top 10). Permission flow always calls `requestFullAccessToEvents`, never short-circuits on cached status.
- `provider.rs` — auto-detects the LLM provider from the API key prefix (`sk-` → OpenAI, `sk-ant-` → Anthropic, `AIza` → Gemini). Returns `Option<Provider>` so unknown prefixes (xAI / OpenRouter / unrecognized) surface as a clear error rather than silently falling back. Holds each provider's base URL and default model.
- `gemini.rs` — Google Gemini chat completion. Separate module because the wire format is different (roles user/model, system_instruction hoisted, tools as function_declarations, functionCall / functionResponse parts, key as ?key= query param, `:streamGenerateContent?alt=sse`). Reuses `openai::execute_tool` and `openai::all_tools()` so tools are defined once.
- `anthropic.rs` — Anthropic Messages API. Separate again: x-api-key header + anthropic-version, system field hoisted, content blocks (text / tool_use / tool_result) instead of plain string content, typed SSE events (content_block_start / content_block_delta with input_json_delta / message_delta), max_tokens required. Reuses `openai::execute_tool` and `openai::all_tools()`.
- `capabilities.rs` — single source of truth for the `list_capabilities` self-introduction tool. When you add a new tool, also add a matching short example here so users can discover it just by asking "何ができるの？".
- `finder.rs` — `open_finder` tool. Resolves keywords (downloads / desktop / documents / applications / trash / etc., plus their Japanese aliases) and literal paths (with `~/` expansion) and opens them via macOS `open`.
- `model.rs` — auto-downloads the Whisper model (`ggml-small.bin`) into `~/.chappie/models/`. Streams via `reqwest`, emits `model:progress` and `model:ready` events.
- `audio.rs` — cpal-based mic capture on a dedicated OS thread → mono f32 → rubato resample to 16kHz → Silero VAD on 512-sample frames → RMS gate (drops near-silent segments before Whisper to kill static hallucinations) → Whisper → emit `speech` event. `pause_listening` / `resume_listening` flip a global `MUTED` flag for transient TTS-time muting; the tray-driven mic on/off goes through `start_listening` / `stop_listening` instead so the cpal stream is fully released.
- `openai.rs` — `chat_complete(api_key, model, messages, on_chunk)` Tauri command. Auto-detects the provider from the API key prefix (via `provider.rs`) and routes: OpenAI uses chat/completions; Anthropic and Gemini delegate to dedicated modules. Streams via SSE through a `Channel<String>` so the renderer can begin TTS on the first sentence. Multi-round tool calling with marker-tool round-skip. Tools: `end_conversation`, `get_current_time`, `set_timer` / `list_timers` / `cancel_timer`, `add_reminder_at` / `list_reminders` / `cancel_reminder`, `open_url`, `web_search`, `get_weather`, `open_app`, `open_finder`, `get_volume` / `set_volume` / `set_mute`, `control_music` / `get_now_playing`, `get_battery_status`, `read_clipboard` / `write_clipboard`, `take_screenshot`, `add_note` / `list_notes` / `delete_note`, `save_memory` / `recall_memory` / `list_memories` / `forget_memory`, `lock_screen`, `set_sleep_prevention` / `get_sleep_prevention`, `list_events` (today/tomorrow/upcoming, EventKit read-only), `list_capabilities` (selection/fullscreen × clipboard/file). `set_mute` also pushes a brief HUD ("🔇 ミュート" / "🔊 ミュート解除"). The renderer never touches the API key in HTTP code.
- `timer.rs` — in-memory tokio-based timer manager. `set_timer` schedules with `tokio::spawn`; on fire emits `timer:fired` and the renderer announces via TTS (or HUD if muted). Also runs `start_tray_title_ticker` — a 1Hz task that finds the soonest-firing timer, formats `M:SS`, and updates the tray title (combined with `🔔` if `UPDATE_AVAILABLE`).
- `reminder.rs` — absolute-time reminders persisted to `~/.chappie/reminders.json`. Distinct from `timer.rs` because reminders ("明日7時") must survive app restart while timers ("3分後") are intentionally ephemeral. `init` on startup drops past-due entries and re-schedules the rest. Fires `reminder:fired` (separate event) so the renderer can phrase it as "○○の時間です" rather than the timer's "○○のタイマーです".
- `log_event.rs` — `linfo!` / `lwarn!` / `lerror!` macros that both eprintln and emit a `log` event so the renderer's `lib/log-bridge.ts` can mirror Rust logs into the Web Inspector console.
- `mic_permission.rs` — `AVCaptureDevice.requestAccessForMediaType:` via objc2 + block2. **Always invokes requestAccess regardless of cached status** (cached status can be wrong for ad-hoc signed apps). Mirrors Galopen's calendar permission pattern.
- `screen_permission.rs` — `SCShareableContent.getShareableContentWithCompletionHandler:` from ScreenCaptureKit. Used because `CGRequestScreenCaptureAccess()` is synchronous and frequently never shows the dialog for ad-hoc signed apps. The async completion-handler pattern matches mic_permission and reliably triggers the system TCC prompt. Required for `take_screenshot`'s fullscreen mode (selection mode `-i` works without).
- `i18n.rs` — global `Lang` enum (ja/en/es/fr/de/zh/pt/ko/it) backed by a `Mutex<Lang>`. `set_app_language` Tauri command updates it and re-applies the tray; `tray.rs` / `updater.rs` / `capabilities.rs` branch on `current()`.
- The Whisper context lives globally in `OnceCell<Mutex<WhisperContext>>`. Whisper's language hint is held in a separate `Mutex<Option<&'static str>>` and is updated by the renderer via `set_whisper_language` whenever the user changes language in Settings.

### Frontend (`src/`)

- `main.tsx` — routes `?view=settings` → SettingsView, `?view=hud` → HudView, anything else → ConversationView.
- `views/ConversationWorker.tsx` — headless component for the hidden main window. Mounts `useConversationLoop` and renders nothing visible; all diagnostics flow into the Web Inspector console via `lib/log-bridge.ts`.
- `views/SettingsView.tsx` — on-demand settings window opened from the tray menu (mic permission, screen-recording permission, API key + provider detection, language picker, autostart). The voice picker was removed — voice now follows the language setting automatically.
- `i18n/messages.ts` — typed message catalogs for 9 languages plus a `WAKE_ACKS` table for randomized wake-word acknowledgements. `t(lang, key, params?)` does dotted-path lookup with `{name}` substitution. `resolveLanguage("auto")` sniffs `navigator.language`.
- `i18n/useT.ts` — React hook that loads the language from settings, listens for `settings:updated`, and returns a bound `t()`.
- `lib/provider.ts` — renderer-side mirror of `provider.rs::detect_from_key` (prefix → provider). Powers the "Detected: {provider}" hint under the API key field.
- `views/HudView.tsx` + `HudView.module.css` + `HudView.global.css` — Raycast-style transparent overlay. Listens for `hud:show` events and fades a cream-pill card in/out (Chappie portrait + text). Avatar swaps based on text content (listening pose for mute / 👂 / errors, talking pose otherwise).
- `hooks/useConversationLoop.ts` — calls `request_microphone_access` → `ensure_model` → `start_listening`, then listens for `speech` events from Rust and dispatches wake-word detection → `chat_complete` (Rust IPC) → TTS-or-HUD → tray sync. The output channel is decided **at the first text chunk** by querying `is_muted`: muted → buffer chunks and call `hud_show` with the full reply at the end (skips streaming TTS); not muted → normal streaming `createStreamingSpeaker`. The same branch covers wake-word ack ("👂 はい" on HUD when muted), API-key-missing errors, the `openai` failure fallback, and the timer-fired announcement. Wraps every `speak()` in `withMutedCapture()` (pause_listening + 350ms cooldown) so the mic pipeline doesn't process Chappie's own voice. After a successful turn, opens a 6s "continuation window" where the next utterance is treated as the body without requiring the wake-word again. Wake ack rotates a randomized list of soft/casual phrases (`はーい` / `なーに？` / `どうしたの？` etc.) so it doesn't sound canned.
- `lib/state-machine.ts` — pure state machine (idle/listening/thinking/speaking/error).
- `lib/conversation-history.ts` — sliding window of the last 20 messages.
- `lib/openai-client.ts` — thin wrapper that calls the Rust `chat_complete` Tauri command (no provider SDK in the renderer; the Rust side picks the right client based on the API key prefix).
- `lib/wake-word.ts` — normalized matching for `chappie` / `チャッピー` plus Whisper homophone variants (`チョッピー` / `Juppie` / etc.).
- `lib/speech-synthesis.ts` — Promise wrapper over `speechSynthesis.speak()`. Default `rate = 1.15` (the macOS Japanese voices feel slow at the spec default).
- `lib/auto-update.ts` — runs at startup. If an update is found and the user dismisses the prompt, calls `set_update_available(true)` so the tray title shows a persistent `🔔` badge until the next successful update + relaunch.
- `lib/settings.ts` — thin wrapper over `tauri-plugin-store`.

## Key Design Decisions

- **whisper-rs lives in Rust**: an early `@xenova/transformers` WebGPU/WASM Whisper attempt held the renderer hostage and ignored Apple's Metal stack, so STT moved to Rust.
- **Mic capture + VAD live in Rust** (cpal + Silero via `voice_activity_detector`): WKWebView's `getUserMedia` hangs forever on hidden, accessory-mode windows without a user gesture. Doing capture at the OS layer sidesteps the entire WebKit permission/activation issue and emits a single `speech` event per utterance to the renderer.
- **Wake-word detection is renderer-side string matching**: Whisper output is normalized (NFKC + lowercase) and substring-matched. `chappie` / `チャッピー` plus tolerance for homophone variants (`チョッピー` etc).
- **Mic capture is paused at the Rust layer during TTS**: a `MUTED` AtomicBool gates the segmenter, so we never feed Chappie's own voice to Whisper *and* save the inference cost. A 350ms cooldown after `speak()` returns covers speaker reverb. `speechSynthesis.cancel()` is called before each `speak()` to clear any wedged WebKit synthesis queue, and `cancelSpeech()` is exposed for future barge-in.
- **Conversation end is decided by the model, not a timer**: the `end_conversation` tool definition is included with every chat_complete request. When the user says goodbye and the model calls the tool, the loop skips the continuation window and waits for a fresh wake-word. The 6s continuation window remains as a fallback for normal turns.
- **macOS ObjC interop is panic + exception guarded**: `mic_permission.rs` wraps every AVCaptureDevice call in `panic::catch_unwind` + `objc2::exception::catch`, modeled after galopen's calendar.rs. An NSException from a broken entitlement no longer takes the whole process down.
- **Tool routing is verified by a golden test**: `src-tauri/tests/golden_tool_routing.rs` hits real LLM providers with ~25 transcribed utterances and asserts on the tool-name sequence the LLM picks. Skipped by default; runs only when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` are set in the env. Trigger via `pnpm test:golden` — that calls `scripts/run-golden.sh`, which sources `.env.golden` (gitignored) before invoking `cargo test`. Copy `.env.golden.example` → `.env.golden` and paste the keys you have (the test skips providers whose key is missing, so partial setup is fine). Each full 3-provider sweep is ~$0.10–0.15 on today's pricing (gpt-4o-mini + claude-3-5-haiku + gemini-2.5-flash, with caching factored in), so the assistant runs them on a low-cadence basis (typically before merging tool-definition or system-prompt changes), not on every commit. Tests are dry-run: tool calls are intercepted by name, never executed, and stub results are fed back to the LLM so multi-round sequences (e.g. "音量下げて" → `[get_volume, set_volume]`) can be verified without touching system state.
- **Prompt caching is enabled per provider**: tool definitions + persona system prompt run ~9k tokens per turn. Caching cuts that drastically. Anthropic uses explicit `cache_control: { type: "ephemeral" }` markers on system + last tool (90% discount, 5min TTL). OpenAI auto-caches prompts ≥1024 tokens (50% discount); we send `stream_options.include_usage` to log cached_tokens. Gemini 2.5 implicit caching kicks in automatically (75% discount); we log `usageMetadata.cachedContentTokenCount`. To keep cache hit rates high, location grounding is injected AFTER the static persona system message in all three providers, not at index 0.
- **LLM HTTP lives in Rust**: the renderer doesn't ship any provider SDK or hold the API key in HTTP code. The key is passed from the Tauri store into the `chat_complete` command, the prefix determines the provider, and Rust forwards the request to the right endpoint with the right auth scheme (Bearer for OpenAI-compatible, `x-api-key` for Anthropic, `?key=` query param for Gemini).
- **Settings hot-reload via `settings:updated`**: API key and voice are reflected in the running loop without restart. Autostart still applies on next launch (handled by the OS).
- **Whisper initial prompt biases toward "チャッピー"**: `set_initial_prompt("チャッピー、はい、チャッピーです。")` improves wake-word recognition.
- **Color-state icons, not template icons**: state is conveyed by hue (template-style would only convey state by shape).
- **Main window is hidden / debug-only**: the conversation worker runs there but it has no user-facing UI in the normal flow. Open it via tray → "デバッグウィンドウを開く" to see the live transcription log.
- **HUD is the visual fallback for the audio channel**: when the system is muted, TTS goes silent but the user still needs to know what Chappie is saying. The HUD (`hud.rs` + `views/HudView.tsx`) renders a cream-pill overlay at the bottom-center of whichever monitor the cursor is on, used both for direct status (mute toggle, timer fire) and for full reply text when muted. Routing is decided per-turn at the first chunk because the model can mute the system mid-turn via `set_mute`. When in muted mode the renderer also injects a per-request system message asking the model to use display-friendly numerics (`17.3度` / `39%` / `14:30`) instead of the TTS-friendly forms (`17点3度` / `39パーセント`).
- **Tray title carries time-progressive state, nothing else**: `timer.rs::start_tray_title_ticker` writes `M:SS` (shortest remaining timer) to the tray title every second, prefixed with `🔔` if an update is pending. State that doesn't change with time stays in the icon (color = listening/thinking/speaking/error) — no duplication.
- **HUD requires `macOSPrivateApi`**: `transparent: true` Tauri windows on macOS need the private API flag (set in `tauri.conf.json` and as the `tauri/macos-private-api` Cargo feature). Ad-hoc signing still works; this is unrelated to App Store distribution.

## Build & Distribute

### Development

```bash
pnpm install
bash scripts/fetch-model.sh     # one-time: fetch the Whisper small model (~466MB)
pnpm tauri dev
```

### Release build (env vars are required)

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/chappie.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build
```

- `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD`: minisign signing for the updater (auto-update breaks without it).
- `APPLE_SIGNING_IDENTITY="-"`: ad-hoc code signing. **Skip this and macOS will show "the app is damaged" after distribution.**

Outputs:
- `src-tauri/target/release/bundle/macos/Chappie.app`
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz` (updater feed)
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz.sig` (minisign signature)
- `src-tauri/target/release/bundle/dmg/Chappie_<version>_aarch64.dmg`

### Release (publish to GitHub + bump updater feed)

1. Bump versions in `package.json` and `src-tauri/tauri.conf.json`.
2. Run the release build above with the env vars.
3. `pnpm release` — creates the GitHub Release and uploads `.app.tar.gz` / `.sig` / `latest.json` / `.dmg`.
4. The updater feed at `https://github.com/piro0919/chappie/releases/latest/download/latest.json` will surface the new build to existing installs on next launch.

## Spec & Plan

- Design doc: `docs/superpowers/specs/2026-05-06-chappie-design.md` (Japanese, working doc)
- Implementation plan: `docs/superpowers/plans/2026-05-06-chappie-mvp.md` (Japanese, working doc; progress tracked via checkboxes)

## Working Notes (must read before debugging permission/system-level issues)

### macOS マイク許可（同様の OS 権限） — 過去の失敗から

ad-hoc 署名（`APPLE_SIGNING_IDENTITY="-"`）+ LSUIElement の Tauri アプリでも、macOS のマイク（および同種の OS 権限）は **正しく実装すれば普通に動く**。本番に Apple Developer Program は不要。

実装すべきこと（これだけで動く）：

1. `src-tauri/Entitlements.plist` に該当エンタイトルメント（マイクなら `com.apple.security.device.audio-input`）を入れて `tauri.conf.json` の `macOS.entitlements` で参照させる
2. `Info.plist` に `NSMicrophoneUsageDescription` を入れる
3. Rust 側で `AVCaptureDevice.requestAccessForMediaType:completionHandler:` を **専用スレッドから / status チェックで早期 return せず常に呼ぶ**。完了は `block2::RcBlock` で受ける
4. 手本: `~/Repository/galopen/src-tauri/src/calendar.rs`（カレンダー版だがパターンは同一）

やってはいけないこと（過去にハマった寄り道）：

- `authorizationStatusForMediaType:` の値で早期 return → プロンプトが出ない原因。常に requestAccess を呼ぶ
- `ActivationPolicy::Accessory` → `Regular` に切り替える → 不要、プロンプトは出る
- WKWebView の `getUserMedia` で取りに行く → 隠しウィンドウだと user activation 無しでハングする。マイクは Rust 側で取る（cpal 等）か、別途 user gesture を伴う UI から呼ぶ
- ad-hoc 署名そのものを諦める / Apple Developer 加入を勧める → 解決ではない、原因ではない

### デバッグ時の鉄則

ユーザーが「○○リポジトリを見て」のような **同マシン上の動いている参照実装** を提示したら、Web 検索や推測より先に必ず `Read` で開いて差分を取る。Web 検索結果（特に未解決の Apple Developer Forum スレッドや AI 要約）を「解決不能の根拠」として扱わない。動いている現物が常に最強のエビデンス。
