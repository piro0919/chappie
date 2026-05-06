# Chappie

A hands-free voice AI assistant. Wake it with "**chappie**" (English) or "**チャッピー**" (Japanese) and have a fully voice-driven conversation, all from a tray-only desktop app.

## Tech Stack

- **Tauri v2** (Rust backend + WebView UI)
- **React 19 + Vite + TypeScript** (renderer)
- **pnpm** (package manager)
- **whisper-rs** (local STT, Metal-accelerated on macOS)
- **`@ricky0123/vad-web`** (voice activity detection)
- **OpenAI Chat Completions** (`gpt-4o-mini`, hardcoded)
- **Web Speech API `SpeechSynthesis`** (TTS)

## Architecture

### Rust Backend (`src-tauri/src/`)

- `lib.rs` — main: Builder, plugin registration, tray init, Tauri commands (`transcribe`, `set_tray_state`, `open_settings`, `ensure_model`). Hides the Dock icon (`ActivationPolicy::Accessory`); blocks duplicate launches via `tauri-plugin-single-instance`.
- `tray.rs` — menu-bar tray icon (5 states: idle/listening/thinking/speaking/error). Switches icon, tooltip, and menu per state.
- `model.rs` — auto-downloads the Whisper model (`ggml-base.bin`) into `~/.chappie/models/`. Streams via `reqwest`, emits `model:progress` and `model:ready` events.
- The Whisper context lives globally in `OnceCell<Mutex<WhisperContext>>`.

### Frontend (`src/`)

- `main.tsx` — routes `?view=settings` → SettingsView, anything else → ConversationView.
- `views/ConversationView.tsx` — UI for the hidden conversation worker window (status text only).
- `views/SettingsView.tsx` — on-demand settings window opened from the tray menu (OpenAI API key + voice + autostart).
- `hooks/useConversationLoop.ts` — orchestrates VAD → Whisper → wake-word detection → OpenAI → TTS → tray sync.
- `lib/state-machine.ts` — pure state machine (idle/listening/thinking/speaking/error).
- `lib/conversation-history.ts` — sliding window of the last 20 messages.
- `lib/openai-client.ts` — thin wrapper over the OpenAI SDK.
- `lib/wake-word.ts` — normalized matching for `chappie` / `チャッピー` plus Whisper homophone variants (`チョッピー` / `Juppie` / etc.).
- `lib/speech-synthesis.ts` — Promise wrapper over `speechSynthesis.speak()`.
- `lib/settings.ts` — thin wrapper over `tauri-plugin-store`.

## Key Design Decisions

- **whisper-rs lives in Rust**: an early `@xenova/transformers` WebGPU/WASM Whisper attempt held the renderer hostage and ignored Apple's Metal stack, so STT moved to Rust.
- **VAD lives in the renderer**: `@ricky0123/vad-web` (lightweight, ~1-2% CPU). When it detects an utterance boundary it ships PCM (Float32Array) to Rust through a Tauri command.
- **Wake-word detection is renderer-side string matching**: Whisper output is normalized (NFKC + lowercase) and substring-matched. `chappie` / `チャッピー` plus tolerance for homophone variants.
- **VAD pauses while TTS plays**: prevents Chappie's own voice from re-triggering itself.
- **Settings changes apply on next app launch** (MVP): a `settings:updated` event path exists too, but simpler is better.
- **Whisper initial prompt biases toward "チャッピー"**: `set_initial_prompt("チャッピー、はい、チャッピーです。")` teaches the base model the wake word so transcription accuracy holds up.
- **Color-state icons, not template icons**: state is conveyed by hue (template-style would only convey state by shape).
- **Main window is hidden**: the conversation worker runs in a hidden main window; the user only ever interacts via the tray icon and the on-demand Settings window.

## Build & Distribute

### Development

```bash
pnpm install
bash scripts/fetch-model.sh     # one-time: fetch the Whisper base model (~150MB)
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
