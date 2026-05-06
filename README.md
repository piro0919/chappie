# Chappie

A hands-free voice AI assistant for macOS. Say "**chappie**" (or "チャッピー" in Japanese) to wake it up and have a fully voice-driven conversation, all from the menu bar.

## Architecture

- **Tauri 2** (Rust backend + WebView UI)
- **Voice activity detection**: [`@ricky0123/vad-web`](https://github.com/ricky0123/vad)
- **Speech-to-text**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs) (Rust, Metal-accelerated on macOS)
- **Wake word matching**: in-renderer string match (NFKC normalization + tolerant variants)
- **AI**: OpenAI Chat Completions (`gpt-4o-mini`)
- **Text-to-speech**: Web Speech API `SpeechSynthesis` (OS native voices)
- **Settings persistence**: `tauri-plugin-store`

## Development

### Requirements

- macOS 13+ or Windows 10+
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (for the Tauri build)

### Setup & run

```bash
pnpm install
pnpm tauri dev
```

On first launch the Whisper `base` model (~150MB) is auto-downloaded to `~/.chappie/models/ggml-base.bin`. Once it's ready the Chappie icon appears in the menu bar; pick "Open Settings" and add your OpenAI API key to start talking.

> Settings changes (API key, voice) take effect on next app launch.

### Manual model fetch

```bash
bash scripts/fetch-model.sh
```

## Usage

1. Right-click the menu bar icon → **Open Settings**
2. Enter your OpenAI API key (`sk-...`) → Save → restart the app
3. Say "**chappie, good morning**" — or just "chappie" then pause and say your message

The menu bar icon color tells you the current state:

| State | Color |
|-------|-------|
| idle | gray |
| listening | light blue |
| thinking | yellow |
| speaking | green |
| error | red |

## Build

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/chappie.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build
```

Outputs:
- macOS: `src-tauri/target/release/bundle/macos/Chappie.app` and `dmg/Chappie_<version>_*.dmg`
- Windows: `src-tauri/target/release/bundle/nsis/Chappie_<version>_*-setup.exe`

> The macOS DMG bundler (`bundle_dmg.sh`) drives Finder via AppleScript, which can hang in non-interactive environments. Distributing the `.app` directly is the safer path.
>
> The build is ad-hoc code-signed only (no notarization). On first launch on macOS, right-click the app and choose "Open" to bypass Gatekeeper.

## Test

```bash
pnpm test:run    # one-shot
pnpm test        # watch mode
```

Pure logic (state machine, conversation history, OpenAI client wrapper, wake-word detection, settings) is covered by Vitest unit tests. The audio chain (VAD / Whisper / TTS) and Tauri command bridges are verified manually.

## License

MIT
