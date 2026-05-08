<div align="center">
  <img src="lp/public/hero.png" alt="Chappie" width="220" />

  # Chappie

  **Just say "chappie" — the rest is voice only.**

  A hands-free voice AI assistant for macOS that lives in your menu bar.

  🌐 [chappie.kkweb.io](https://chappie.kkweb.io) · 📦 [Latest release](https://github.com/piro0919/chappie/releases/latest) · 🦀 Tauri 2 + Rust + React

</div>

---

<div align="center">
  <img src="lp/public/menubar.png" alt="Chappie in the macOS menu bar" width="640" />
</div>

## Highlights

- 🎙 **No hotkeys, no clicks** — just say the wake word; Chappie remembers the flow of the conversation
- 🔒 **Your voice stays on your Mac** — speech is transcribed locally with Whisper; the raw audio never leaves the device
- 🍎 **Menu bar resident, no Dock clutter** — shows up only when you need it
- 🗣 **Pick a macOS system voice** — switch between Japanese / English, male / female
- ♻ **Auto-update** — new versions surface at launch; one click to update

## What it can do

| | Capability | Example |
|---|---|---|
| 💬 | Chat | "Help me plan tomorrow's schedule" |
| ⏲ | Timers | "Set a 3-minute timer", "Cancel all timers" |
| ⏰ | Reminders | "Wake me up at 7 tomorrow", "8 PM, take my meds" (persisted) |
| 🕐 | Date & time | "What time is it?", "What day is it today?" |
| ⛅ | Weather | "What's the weather in Tokyo?" |
| 🌐 | Open sites & web search | "Open YouTube", "Google how to make ramen" |
| 🚀 | Launch Mac apps | "Open Slack", "Launch Spotify" |
| 🔊 | System volume | "Set the volume to 30", "Mute", "Turn it down a bit" |
| 🎵 | Music control | "Next track", "Pause", "What song is this?" (Spotify / Apple Music) |
| 📋 | Clipboard | "Read what I just copied", "Copy that for me" |
| 📝 | Voice notes | "Note this down: parking B3", "Find the Wi-Fi note" (persisted) |
| 🔋 | Battery status | "What's my battery at?", "How much charge is left?" |
| 📸 | Screenshot | "Take a screenshot", "Capture the whole screen and save it to my desktop" |
| 👋 | Goodbye → back to standby | "Thanks, see you later" |

More tools coming over time.

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="lp/public/hero.png" alt="Chappie idle" width="120" /><br><b>Idle</b></td>
      <td align="center"><img src="lp/public/listening.png" alt="Chappie listening" width="120" /><br><b>Listening</b></td>
      <td align="center"><img src="lp/public/talking.png" alt="Chappie talking" width="120" /><br><b>Talking</b></td>
    </tr>
  </table>
</div>

## Architecture

- **Tauri 2** (Rust backend + WebView UI)
- **Mic capture & VAD in Rust**: [`cpal`](https://github.com/RustAudio/cpal) for input, [`voice_activity_detector`](https://crates.io/crates/voice_activity_detector) (Silero VAD V5) for utterance segmentation
- **Speech-to-text**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs) (Rust, Metal-accelerated on macOS) using `ggml-small.bin`
- **Wake-word matching**: renderer-side string match (NFKC normalization + Whisper homophone variants)
- **AI**: OpenAI Chat Completions (default `gpt-4o-mini`, switchable in Settings; HTTP call lives in Rust so the API key never enters the renderer)
- **Tools**: `set_timer` / `list_timers` / `cancel_timer` / `add_reminder_at` / `list_reminders` / `cancel_reminder` / `get_current_time` / `get_weather` / `open_url` / `web_search` / `open_app` / `get_volume` / `set_volume` / `set_mute` / `control_music` / `get_now_playing` / `get_battery_status` / `read_clipboard` / `write_clipboard` / `take_screenshot` / `add_note` / `list_notes` / `delete_note` / `end_conversation` (multi-round tool calling in `openai.rs`)
- **Text-to-speech**: Web Speech API `SpeechSynthesis` (macOS native voices), streamed sentence-by-sentence as the model produces tokens
- **Visual HUD**: a transparent always-on-top overlay window. Confirms volume / mute toggles, surfaces timer fires, and — when the system is muted — renders Chappie's full reply as text since TTS would be inaudible
- **Menu bar countdown**: when a timer is running, the tray title shows `M:SS` next to the icon (Galopen pattern). Combined with `🔔` when an update is pending
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

- macOS 14+ on Apple Silicon (M1 or later)
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable toolchain)

### Setup & run

```bash
pnpm install
pnpm tauri dev
```

On first launch the Whisper `small` model (~466MB) is auto-downloaded to
`~/.chappie/models/ggml-small.bin`. Once it's ready the Chappie icon appears
in the menu bar; open **Settings** from the tray menu and add your OpenAI
API key to start talking.

The first time the app accesses the mic, macOS will show a system permission
prompt (driven by `AVCaptureDevice.requestAccess`). After granting,
`Chappie` appears in System Settings → Privacy & Security → Microphone.

Settings changes (API key, model, voice) hot-reload via the
`settings:updated` event — no restart needed. Autostart only applies on next
launch (handled by macOS).

### Manual model fetch

```bash
bash scripts/fetch-model.sh
```

### Debugging

The conversation worker runs in a hidden main window with devtools open in
debug builds. The Web Inspector's Console shows logs from both the renderer
(`[loop]` / `[timer]`) and Rust side (`[audio]` / `[whisper]` / `[openai]`),
unified through `lib/log-bridge.ts`.

## Usage

1. Click the menu-bar icon → **Settings**
2. Enter your OpenAI API key (`sk-...`) → Save
3. Say "**chappie, how are you?**" — or just "chappie", wait for the brief acknowledgement, then speak your message
   (The Japanese wake word "チャッピー" works too)

The menu-bar icon reflects the current state:

| State | Notes |
|---|---|
| initializing | Loading model / starting mic |
| idle | Listening for the wake word |
| listening | Capturing your follow-up |
| thinking | Whisper + OpenAI in flight |
| speaking | TTS playing the reply |
| error | See devtools console |

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
