# Chappie

A hands-free voice AI assistant for macOS. Say "**chappie**" (or "チャッピー" in Japanese) to wake it up and have a fully voice-driven conversation, all from the menu bar.

🌐 [chappie.kkweb.io](https://chappie.kkweb.io) · 📦 [Latest release](https://github.com/piro0919/chappie/releases/latest)

## Architecture

- **Tauri 2** (Rust backend + WebView UI)
- **Mic capture & VAD in Rust**: [`cpal`](https://github.com/RustAudio/cpal) for input, [`voice_activity_detector`](https://crates.io/crates/voice_activity_detector) (Silero VAD V5) for utterance segmentation
- **Speech-to-text**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs) (Rust, Metal-accelerated on macOS) using `ggml-small.bin`
- **Wake-word matching**: renderer-side string match (NFKC normalization + Whisper homophone variants)
- **AI**: OpenAI Chat Completions (`gpt-4o-mini`)
- **Text-to-speech**: Web Speech API `SpeechSynthesis` (macOS native voices)
- **Mic permission**: `AVCaptureDevice.requestAccessForMediaType:` via objc2 + block2
- **Settings persistence**: `tauri-plugin-store`
- **Auto-update**: `tauri-plugin-updater` with confirmation dialog (`tauri-plugin-dialog`)

> WKWebView's `getUserMedia` hangs forever for hidden, accessory-mode windows
> without a user gesture, so audio is captured at the OS layer in Rust and
> only the resulting transcription is forwarded to the renderer as a `speech` event.

## Platform

macOS only, Apple Silicon (`aarch64-apple-darwin`). Tested on macOS 14+. The mic
capture and Whisper inference rely on macOS-specific APIs (AVFoundation /
Metal); a Windows port is technically feasible but not on the roadmap.

## Development

### Requirements

- macOS 14+ on Apple Silicon
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable toolchain)

### Setup & run

```bash
pnpm install
pnpm tauri dev
```

On first launch the Whisper `small` model (~466MB) is auto-downloaded to
`~/.chappie/models/ggml-small.bin`. Once it's ready the Chappie icon appears
in the menu bar; pick **設定を開く** and add your OpenAI API key to start
talking.

The first time the app accesses the mic, macOS will show a system permission
prompt (driven by `AVCaptureDevice.requestAccess`). After granting,
`Chappie` appears in System Settings → Privacy & Security → Microphone.

> Settings changes (API key, voice) take effect on next app launch.

### Manual model fetch

```bash
bash scripts/fetch-model.sh
```

### Debug window

The conversation worker runs in a hidden main window. Open the tray menu →
**デバッグウィンドウを開く** to see a live log of what Whisper transcribed.

## Usage

1. Click the menu-bar icon → **設定を開く**
2. Enter your OpenAI API key (`sk-...`) → Save → restart the app
3. Say "**チャッピー、調子どう？**" — or just "チャッピー", pause, then say
   your message in a follow-up turn

The menu-bar icon shows the current state:

| State | Tooltip | Notes |
|-------|---------|-------|
| initializing | 起動中 | Loading model / starting mic |
| idle | 待機中 | Listening for the wake word |
| listening | 聞いています | Capturing your follow-up |
| thinking | 考え中 | Whisper + OpenAI in flight |
| speaking | 喋っています | TTS playing the reply |
| error | エラー | See the debug window for details |

## Build

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/chappie.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build
```

Outputs:

- `src-tauri/target/release/bundle/macos/Chappie.app`
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz` + `.sig` (updater feed)
- `src-tauri/target/release/bundle/dmg/Chappie_<version>_aarch64.dmg`

> `APPLE_SIGNING_IDENTITY="-"` is ad-hoc signing. Without it macOS will report
> "the app is damaged" after distribution. There is no notarization, so on
> first launch users may need to right-click → Open to bypass Gatekeeper.
>
> The DMG step drives Finder via AppleScript and occasionally hangs. If you
> only need the updater payload, pass `--bundles app` to skip DMG.

## Release

1. Bump versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Run the release build above with the signing env vars.
3. `pnpm release` — creates the GitHub Release and uploads `.app.tar.gz` /
   `.sig` / `latest.json` / `.dmg`.
4. The updater feed at
   <https://github.com/piro0919/chappie/releases/latest/download/latest.json>
   surfaces the new build to existing installs on next launch (with a
   confirmation dialog).

## Landing page

The marketing site under [`lp/`](./lp/) is a Next.js 16 project deployed to
[chappie.kkweb.io](https://chappie.kkweb.io) on Vercel.

```bash
cd lp
pnpm dev    # http://localhost:3000
pnpm build  # production build
```

## Test

```bash
pnpm test:run    # one-shot
pnpm test        # watch mode
```

Pure logic (state machine, conversation history, OpenAI client wrapper,
wake-word detection, settings) is covered by Vitest unit tests. The audio
pipeline (cpal capture / Silero VAD / Whisper) and Tauri command bridges are
verified manually.

## License

MIT
