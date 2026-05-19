# Chappie

A hands-free voice AI assistant. Wake it with "**chappie**" (English) or "**チャッピー**" (Japanese) and have a fully voice-driven conversation, all from a tray-only desktop app.

## Tech Stack

- **Tauri v2** (Rust backend + WebView UI)
- **React 19 + Vite + TypeScript** (renderer)
- **pnpm** (package manager)
- **whisper-rs** (local STT, Metal-accelerated on macOS) — uses `ggml-small.bin`
- **cpal** (mic capture in Rust) + **rubato** (resampling) + **webrtc-audio-processing** (AGC2 + NS + HPF) + **voice_activity_detector** (Silero VAD V5)
- **Speaker recognition** (opt-in): **WeSpeaker ECAPA-TDNN-512-LM** (192-dim, CC-BY-4.0, ~25MB, downloaded on first enroll) via **tract-onnx** + **kaldi-fbank-rust-kautism** (80-dim mel fbank). Cosine-similarity gate against an enrolled voiceprint (`~/.chappie/voice.bin`). Permissive bypass when not enrolled or model missing.
- **Multi-provider LLM** (OpenAI / Anthropic / Gemini). Provider auto-detected from the API key prefix; settings UI has no provider/model picker. HTTP call lives in Rust via `reqwest` so the key never enters the renderer. Each provider's cheapest tool-capable model is the default; `CHAPPIE_MODEL` env var overrides for power users.
- **Three run modes** (Settings → radio): **Free** routes through the chappie.kkweb.io proxy (Gemini 2.5 Flash, 5 req/day/device, no API key needed); **Pro** (¥500/月, Stripe live) routes through the same proxy without the daily cap and unlocks the 8 paid VOICEVOX speakers; **BYOK** uses the user's own provider key directly (OpenAI / Anthropic / Gemini). Pro and BYOK are mutually exclusive at the radio level — a Pro subscriber who chooses BYOK still gets the premium speakers (entitlement is decided by `subscriptionStatus`, not `mode`). Fresh installs default to Free; existing users with a saved key migrate to BYOK so behavior stays identical. Proxy URL overridable via `CHAPPIE_PROXY_URL` for local dev.
- **Web Speech API `SpeechSynthesis`** (TTS) — voice auto-picked to match the resolved language; no UI picker.
- **i18n**: 9 languages (ja / en / es / fr / de / it / pt / ko / zh). Renderer-side catalog in `src/i18n/messages.ts`; Rust-side `i18n.rs` holds the app-wide language for tray / updater / capabilities.

## Architecture

The codebase splits roughly into a Rust backend (`src-tauri/src/`, ~12.7k lines across ~40 modules) handling audio capture, LLM HTTP, system integration, and Tauri commands; and a React renderer (`src/`, ~7k lines) handling wake-word detection, the conversation loop, settings, and HUD / settings windows.

Per-module reference lives in dedicated docs so this file stays scannable:

- **[docs/modules/rust-backend.md](docs/modules/rust-backend.md)** — every Rust module, grouped by concern (core / audio / LLM / long-term memory / tools / windows / permissions)
- **[docs/modules/frontend.md](docs/modules/frontend.md)** — entry points, views, hooks, libraries, i18n

High-level flow:

- mic → cpal → APM (AGC2 / NS / HPF) → Silero VAD → speaker gate (opt-in) → Whisper → `speech` event
- renderer → wake-word match → `chat_complete` Tauri command → LLM HTTP (OpenAI / Anthropic / Gemini / Free-mode proxy) → SSE-streamed chunks → TTS or HUD
- state machine ([src/lib/state-machine.ts](src/lib/state-machine.ts)) drives the tray icon (6 colored states + 1 off-state) and gates renderer behavior

See the per-module docs for individual file responsibilities and the [Key Design Decisions](#key-design-decisions) section below for the cross-cutting choices that aren't obvious from a single module.

## Key Design Decisions

- **whisper-rs lives in Rust**: an early `@xenova/transformers` WebGPU/WASM Whisper attempt held the renderer hostage and ignored Apple's Metal stack, so STT moved to Rust.
- **Mic capture + VAD live in Rust** (cpal + Silero via `voice_activity_detector`): WKWebView's `getUserMedia` hangs forever on hidden, accessory-mode windows without a user gesture. Doing capture at the OS layer sidesteps the entire WebKit permission/activation issue and emits a single `speech` event per utterance to the renderer.
- **Wake-word detection is renderer-side string matching**: Whisper output is normalized (NFKC + lowercase) and substring-matched. `chappie` / `チャッピー` plus tolerance for homophone variants (`チョッピー` etc).
- **Mic capture is paused at the Rust layer during TTS**: a `MUTED` AtomicBool gates the segmenter, so we never feed Chappie's own voice to Whisper *and* save the inference cost. A 350ms cooldown after `speak()` returns covers speaker reverb. `speechSynthesis.cancel()` is called before each `speak()` to clear any wedged WebKit synthesis queue, and `cancelSpeech()` is exposed for future barge-in.
- **Speaker recognition instead of AEC** (`speaker.rs`): the original v0.11 plan was acoustic echo cancellation against the system audio loopback. We pivoted to voice biometrics because AEC only covers Chappie's own output — it can't help with the TV, YouTube on external speakers, or other people in the room, which are all the *same problem* (something other than the user is talking). One ECAPA-TDNN gate at ~25 MB and 192 dims handles all of them. Model is downloaded on first enrollment, threshold `0.40` (cosine) is intentionally lenient because the cost of false-reject (user has to repeat themselves) is far higher than false-accept (TV slips through occasionally). Untouched / unenrolled installs bypass the gate entirely so the app keeps working without any setup.
- **APM lives BEFORE the speaker gate**: AGC2 normalizes loudness so a soft "chappie" from across the room scores against the same centroid as a close-mic enrollment. Skipping APM during barge-in is critical — without it, AGC happily amplifies leaked TTS into a self-sustaining echo loop. Two-layer fix: APM bypass while `is_barge_in_active()`, plus a sticky `barge_in_seen_in_segment` flag that re-routes any segment that touched barge-in mode to the `speech-bargein` event (which the renderer only honors for explicit cancel commands).
- **Conversation end is decided by the model, not a timer**: the `end_conversation` tool definition is included with every chat_complete request. When the user says goodbye and the model calls the tool, the loop skips the continuation window and waits for a fresh wake-word. The 6s continuation window remains as a fallback for normal turns.
- **macOS ObjC interop is panic + exception guarded**: `mic_permission.rs` wraps every AVCaptureDevice call in `panic::catch_unwind` + `objc2::exception::catch`, modeled after galopen's calendar.rs. An NSException from a broken entitlement no longer takes the whole process down.
- **Tool routing is verified by a golden test**: `src-tauri/tests/golden_tool_routing.rs` hits real LLM providers with ~25 transcribed utterances and asserts on the tool-name sequence the LLM picks. Skipped by default; runs only when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` are set in the env. Trigger via `pnpm test:golden` — that calls `scripts/run-golden.sh`, which sources `.env.golden` (gitignored) before invoking `cargo test`. Copy `.env.golden.example` → `.env.golden` and paste the keys you have (the test skips providers whose key is missing, so partial setup is fine). Each full 3-provider sweep is ~$0.10–0.15 on today's pricing (gpt-4o-mini + claude-3-5-haiku + gemini-2.5-flash, with caching factored in), so the assistant runs them on a low-cadence basis (typically before merging tool-definition or system-prompt changes), not on every commit. Tests are dry-run: tool calls are intercepted by name, never executed, and stub results are fed back to the LLM so multi-round sequences (e.g. "音量下げて" → `[get_volume, set_volume]`) can be verified without touching system state.
- **Multi-turn tool routing is verified by a separate harness**: `scripts/test-tool-routing.mjs` (run via `pnpm test:multi-turn`) covers what the Rust golden test does NOT — the multi-turn context-bias bug where Flash / gpt-4o-mini re-uses the most recent successful tool on the next user utterance regardless of topic. Runs 2 chained-turn scenarios (5 turns each) against Gemini-via-proxy and OpenAI-direct, with the same conversation-history cap (`MAX_NON_SYSTEM = 4`) as the renderer. Uses 5 representative tools, not the full 38; the bias bug is between these few and adding more tools doesn't materially change behavior. Persona prompt is duplicated inline (keep in sync with `src/i18n/messages.ts` `ja.systemPrompt.persona` manually). Catching this regression matters because Free mode's 5/day quota makes wrong tool selection more painful than in BYOK — users have very few attempts.
- **Chitchat fast-path swaps the tool payload at dispatch time**: a 3-AND classifier in [src-tauri/src/llm/chitchat.rs](src-tauri/src/llm/chitchat.rs) (no tool keyword AND short utterance AND chitchat pattern hit) flags pure small-talk ("ありがとう" / "thanks" / "おはよう") and replaces `all_tools()` (~45 tools, ~8.5k tokens) with `minimal_tools()` (just `end_conversation`, ~300 tokens) at [dispatch.rs:84](src-tauri/src/llm/dispatch.rs#L84). The classifier is ultra-conservative — false positives break UX ("can't do that"), false negatives are just a missed savings, so we picked the safe asymmetry. JP/EN keyword + pattern dictionaries are comprehensive; the other 7 languages ship with a baseline list and grow from telemetry. Anthropic's cache_control sits on the "last tool" so swapping the tools array fragments the prefix cache into a chitchat variant and a full variant — accepted because consecutive chitchat turns then cache among themselves, and the chitchat→full transition would have been a cache miss anyway.
- **Prompt caching is enabled per provider**: tool definitions + persona system prompt run ~9k tokens per turn. Caching cuts that drastically. Anthropic uses explicit `cache_control: { type: "ephemeral" }` markers on system + last tool (90% discount, 5min TTL). OpenAI auto-caches prompts ≥1024 tokens (50% discount); we send `stream_options.include_usage` to log cached_tokens. Gemini 2.5 implicit caching kicks in automatically (75% discount); we log `usageMetadata.cachedContentTokenCount`. To keep cache hit rates high, location grounding is injected AFTER the static persona system message in all three providers, not at index 0.
- **LLM HTTP lives in Rust**: the renderer doesn't ship any provider SDK or hold the API key in HTTP code. The key is passed from the Tauri store into the `chat_complete` command, the prefix determines the provider, and Rust forwards the request to the right endpoint with the right auth scheme (Bearer for OpenAI-compatible, `x-api-key` for Anthropic, `?key=` query param for Gemini).
- **Settings hot-reload via `settings:updated`**: API key and voice are reflected in the running loop without restart. Autostart still applies on next launch (handled by the OS).
- **Whisper initial prompt biases toward "チャッピー"**: `set_initial_prompt("チャッピー、はい、チャッピーです。")` improves wake-word recognition.
- **Color-state icons, not template icons**: state is conveyed by hue (template-style would only convey state by shape).
- **Main window is hidden / debug-only**: the conversation worker runs there but it has no user-facing UI in the normal flow. Open it via tray → "デバッグウィンドウを開く" to see the live transcription log.
- **HUD is the visual fallback for the audio channel**: when the system is muted, TTS goes silent but the user still needs to know what Chappie is saying. The HUD (`hud.rs` + `views/HudView.tsx`) renders a cream-pill overlay at the bottom-center of whichever monitor the cursor is on, used both for direct status (mute toggle, timer fire) and for full reply text when muted. Routing is decided per-turn at the first chunk because the model can mute the system mid-turn via `set_mute`. When in muted mode the renderer also injects a per-request system message asking the model to use display-friendly numerics (`17.3度` / `39%` / `14:30`) instead of the TTS-friendly forms (`17点3度` / `39パーセント`).
- **Tray title carries time-progressive state, nothing else**: `timer.rs::start_tray_title_ticker` writes `M:SS` (shortest remaining timer) to the tray title every second, prefixed with `🔔` if an update is pending. State that doesn't change with time stays in the icon (color = listening/thinking/speaking/error) — no duplication.
- **HUD requires `macOSPrivateApi`**: `transparent: true` Tauri windows on macOS need the private API flag (set in `tauri.conf.json` and as the `tauri/macos-private-api` Cargo feature). Ad-hoc signing still works; this is unrelated to App Store distribution.
- **Two-tier location lookup with CoreLocation preferred, IP as fallback**: IP-based geolocation (ipwho.is and friends) is **structurally wrong in Japan** — consumer ISPs route most traffic through Tokyo backbones, so an Aichi user gets weather for Tokyo. CoreLocation gives Wi-Fi-based ~30-100 m precision + reverse-geocoded city via `CLGeocoder`. The permission is asked opt-in from Settings (never auto-prompted), so users who decline still get the IP-based estimate. Cache TTL is 30 min and shared between both sources — the `location::get()` path tries CoreLocation first when `check_permission() == "granted"`, falls back to IP otherwise.
- **Settings is split into Required / Optional sections**: only mic and API key are required (the rest enhance specific features and the app keeps working when not granted/configured). Other permissions — screen recording / calendar / location / speaker recognition — live under "Optional" with a visual section heading so users can tell which prompts are setup-critical vs. nice-to-have. The split matters because all the permissions show up around launch time and we don't want users to think they have to click through every one.
- **Voice → visual impact is a deliberate differentiation axis**: Alexa / Google Home / Siri are speaker-only devices and can't make "something visually change" happen on a screen. Chappie is a Mac tray app, so it CAN — and that's the strongest moat against established voice assistants. First realization is [src-tauri/src/wallpaper.rs](src-tauri/src/wallpaper.rs): "壁紙を森に変えて" → fetch via the [/api/wallpaper](lp/src/app/api/wallpaper/route.ts) Pixabay proxy → osascript sets `picture of every desktop` with a different photo per monitor → HUD pill confirms. Image source is Pixabay rather than Unsplash because Unsplash's demo tier is 50 req/hr per *application* (shared across all chappie users) and getting production approval takes days; Pixabay's verified key gives 100 req/min and is good enough for "おしゃれな壁紙" use cases. The API key lives server-side on chappie.kkweb.io, the desktop only sees image URLs which it re-verifies against `pixabay.com` / `cdn.pixabay.com` before downloading. Future tools in this axis: NASA APOD, Wikipedia On This Day, wallpaper rotation (proactive.rs extension), scheduled briefings. Voice → text-only tools (jokes, trivia, advice slip) are *secondary* — useful but not differentiating.
- **MCP-shaped registry as the extension seam**: new third-party-style integrations (news, RSS, scraping, future SaaS connectors) go through `mcp.rs`, not as bespoke modules wired into `openai.rs`. The registry exposes an MCP-compatible surface (tool list + async dispatch by name) so v1 in-process Rust servers and future stdio JSON-RPC servers are interchangeable. Single insertion point in `openai::all_tools()` (append) and `openai::execute_tool()` (prefix-routed early return) means all 3 providers pick up new MCP tools without per-provider edits. Tools are namespaced `mcp_<server>_<tool>` so dispatch is unambiguous and namespace collisions are impossible.
- **3-layer conversation memory (experimental, opt-in)**: long-term recall is split into **L1 raw** (`session_log.rs` jsonl + `rag.rs` embedding index, >7 days only), **L2 daily summaries** (`summarizer.rs`, past 7 days), and **L3 topic trends** (`topics.rs`, refreshed weekly). The split matters for both prompt-cache stability (L3 changes weekly, L2 daily, L1 per-turn — layered in that order keeps the shared prefix maximal) and content-window economy (L3 stays bounded by extraction, L2 caps at 7 entries, L1 caps at 3 hits ≥ 0.75 cosine). Persona prompt is updated in all 9 i18n locales with a "use naturally, don't open every turn with 'yesterday you…'" clause so the layered context doesn't make the assistant mechanical. The whole stack is gated behind a Settings toggle (model not downloaded → all 3 layers silently no-op) so users who don't want it pay zero cost; users who try and want to roll back can wipe data OR the model independently.
- **Paid-tier entitlement is orthogonal to `mode`**: `mode` (free / paid / byok) controls chat-path routing — Free and Paid go through the chappie.kkweb.io proxy, BYOK calls the provider directly. Premium content gating (VOICEVOX paid speakers) reads `subscriptionStatus` from Supabase via `/api/me`, NOT `mode`. This split is deliberate so a paying user who prefers BYOK for chat (own Anthropic key, full provider control) still keeps the premium voices they're paying for. The Settings UI disables the Free radio while `subscriptionStatus` is entitled — paying and falling back to the 5/day cap is a UX foot-gun. `resolveMode` in `settings.ts` runs a one-time recovery: a pre-v0.12.1 demote bug persisted `mode: "free"` for users who signed in but hadn't completed Stripe checkout yet; the paradoxical state "signed-in + entitled + stored free" can only come from that bug (sign-out always clears email + status together), so promoting back to paid is safe.
- **LP auth (`lp/src/lib/auth.ts`) verifies JWTs via JWKS, with HS256 fallback for local dev**: prod Supabase issues ES256 tokens with a published JWKS at `/auth/v1/.well-known/jwks.json`; `jose.createRemoteJWKSet` handles cache + kid rotation. `supabase start` locally still signs with HS256, so the verifier branches on `decodeProtectedHeader.alg` — HS256 only triggers when `SUPABASE_JWT_SECRET` is present, which is never set in prod. The classifier still treats prod tokens as ES256-only, so an HS256-forged token cannot downgrade a prod request.
- **Local dev uses local Supabase + Stripe sandbox + local LP at :3000**: `scripts/dev-local.sh` (alias: `pnpm dev:local`) sources repo-root `.env.local` so `CHAPPIE_PROXY_URL=http://localhost:3000/api/chat` reaches the Rust process; Vite picks `VITE_CHAPPIE_PROXY_URL` up automatically. LP runs against docker Supabase (`supabase start`) + Stripe test mode keys in `lp/.env.local`. Stripe webhooks land via `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; paste the CLI-printed `whsec_…` into `lp/.env.local` and restart LP. This is the cleanest way to test paid flows end-to-end without touching prod Stripe.

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

Outputs from `pnpm tauri build`:
- `src-tauri/target/release/bundle/macos/Chappie.app`
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz` (updater feed)
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz.sig` (minisign signature)

The DMG is built separately via `pnpm dmg` (called automatically by `pnpm release`). We took it out of the Tauri bundler because Tauri's `bundle_dmg.sh` Finder layout step relies on AppleScript and hangs intermittently. `scripts/build-dmg.sh` uses `hdiutil` directly — no AppleScript, no Finder, no flake — at the cost of giving up the custom window layout / background image (a tray-only app doesn't need those anyway).

### Release (publish to GitHub + bump updater feed)

1. Bump versions in `package.json` and `src-tauri/tauri.conf.json`.
2. Run the release build above with the env vars.
3. `pnpm release` — builds the DMG (`pnpm dmg`), creates the GitHub Release, and uploads `.app.tar.gz` / `.sig` / `latest.json` / `.dmg`.
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
