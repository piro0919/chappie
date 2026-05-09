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
- 🌍 **9 languages** — Japanese / English plus Spanish / French / German / Italian / Portuguese / Korean / Simplified Chinese (Beta). Picks a matching macOS voice automatically.
- 🔁 **Multi-provider, BYO API key** — OpenAI / Anthropic / Gemini. Provider auto-detected from the key prefix.
- ♻ **Auto-update** — checks at launch and every 6 hours; tray badge for new versions; manual check from the menu

## What it can do

| | Capability | Example |
|---|---|---|
| 💬 | Chat | "Help me plan tomorrow's schedule" |
| ⏲ | Timers | "Set a 3-minute timer", "Cancel all timers" |
| ⏰ | Reminders | "Wake me up at 7 tomorrow", "8 PM, take my meds" (persisted) |
| 🕐 | Date & time | "What time is it?", "What day is it today?" |
| ⛅ | Weather | "What's the weather in Tokyo?" |
| 📅 | Calendar | "What's on my calendar today?", "Tomorrow's schedule?", "What's next?" (read-only) |
| 🌐 | Open sites & web search | "Open YouTube", "Google how to make ramen" |
| 🚀 | Launch apps & folders | "Open Slack", "Open my Downloads folder" |
| 🔊 | System volume | "Set the volume to 30", "Mute", "Turn it down a bit" |
| 🎵 | Music control | "Next track", "Pause", "What song is this?" (Spotify / Apple Music) |
| 📋 | Clipboard | "Read what I just copied", "Copy that for me" |
| 📝 | Voice notes | "Note this down: parking B3", "Find the Wi-Fi note" (persisted) |
| 🧠 | Long-term memory | Picks up details about you (name, family, preferences) and carries them across sessions. "What do you know about me?", "Forget that" |
| 🔋 | Battery status | "What's my battery at?", "How much charge is left?" |
| 🔒 | Lock / sleep / stay-awake | "Lock the screen", "Put the Mac to sleep", "Stay awake for 30 minutes" |
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
- **AI**: bring-your-own API key from OpenAI / Anthropic / Gemini. Provider auto-detected from the key prefix (no UI choice). HTTP call lives in Rust so the key never enters the renderer. Default models are each provider's cheapest tool-capable tier; override with `CHAPPIE_MODEL` env var.
- **Tools**: `set_timer` / `list_timers` / `cancel_timer` / `add_reminder_at` / `list_reminders` / `cancel_reminder` / `get_current_time` / `get_weather` / `open_url` / `web_search` / `open_app` / `open_finder` / `get_volume` / `set_volume` / `set_mute` / `control_music` / `get_now_playing` / `get_battery_status` / `read_clipboard` / `write_clipboard` / `take_screenshot` / `add_note` / `list_notes` / `delete_note` / `lock_screen` / `set_sleep_prevention` / `get_sleep_prevention` / `list_capabilities` / `end_conversation` (multi-round tool calling in `openai.rs`)
- **Text-to-speech**: Web Speech API `SpeechSynthesis` (macOS native voices), streamed sentence-by-sentence as the model produces tokens. Voice is auto-selected to match the chosen language — no picker.
- **i18n**: 9 languages cover the UI, system prompt, wake-word ack, timer/reminder readouts, tray menu, updater dialog, and the `list_capabilities` self-introduction. Whisper's language hint is set to the resolved locale.
- **Visual HUD**: a transparent always-on-top overlay window. Confirms volume / mute toggles, surfaces timer fires, and — when the system is muted — renders Chappie's full reply as text since TTS would be inaudible
- **Menu bar countdown**: when a timer is running, the tray title shows `M:SS` next to the icon (Galopen pattern). Combined with `🔔` when an update is pending
- **Mic permission**: `AVCaptureDevice.requestAccessForMediaType:` via objc2 + block2
- **Screen recording permission**: `SCShareableContent.getShareableContentWithCompletionHandler:` from ScreenCaptureKit. Required for `take_screenshot`'s fullscreen mode (selection mode works without).
- **Settings persistence**: `tauri-plugin-store` (API key + language)
- **Auto-update**: `tauri-plugin-updater`. Checks at launch (prompts) and every 6 hours (silent badge); manual "Check for updates" item in the tray menu.

> WKWebView's `getUserMedia` hangs forever for hidden, accessory-mode windows
> without a user gesture, so audio is captured at the OS layer in Rust and
> only the resulting transcription is forwarded to the renderer as a `speech` event.

## Platform support

**macOS** — primary target. Apple Silicon (`aarch64-apple-darwin`), tested on macOS 14+. All features below are available.

**Windows** — incremental port in progress. The Tauri / Rust / WebView layer is cross-platform, but each macOS-specific integration (osascript, pmset, `screencapture`, EventKit, ScreenCaptureKit, AVFoundation) needs a Windows equivalent (`windows-rs` SMTC, `GetSystemPowerStatus`, `SetThreadExecutionState`, etc.). Core loop first, then features ported by usage frequency.

### Feature availability

| Feature | macOS | Windows |
| --- | --- | --- |
| Wake word + STT (Whisper) | ✅ | 🚧 planned |
| LLM chat (OpenAI / Anthropic / Gemini) | ✅ | 🚧 planned |
| TTS (system voices) | ✅ | 🚧 planned |
| Tray icon + states | ✅ | 🚧 planned |
| Timers / reminders | ✅ | 🚧 planned |
| Volume control | ✅ | 🚧 planned |
| Screenshot | ✅ | 🚧 planned |
| Music control (Spotify / Music.app) | ✅ | 🚧 planned (SMTC) |
| Battery / sleep prevention / lock | ✅ | 🚧 planned |
| Calendar (read-only) | ✅ (EventKit) | ❌ not planned for v1 |
| Clipboard / notes / open URL / open app / open Finder | ✅ | 🚧 planned |
| Long-term memory (profile / preference / episode) | ✅ | 🚧 planned (no OS deps, easy port) |
| Auto-update | ✅ | 🚧 planned |

## Development

### Requirements

- macOS 14+ on Apple Silicon (M1 or later) — Windows support is in progress; see the table above for current feature parity
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable toolchain)

### Setup & run

```bash
pnpm install
pnpm tauri dev
```

On first launch the Whisper `small` model (~466MB) is auto-downloaded to
`~/.chappie/models/ggml-small.bin`. Once it's ready the Chappie icon appears
in the menu bar; open **Settings** from the tray menu and paste an API key
from any supported provider (OpenAI / Anthropic / Gemini)
to start talking.

The first time the app accesses the mic, macOS will show a system permission
prompt (driven by `AVCaptureDevice.requestAccess`). After granting,
`Chappie` appears in System Settings → Privacy & Security → Microphone.

Settings changes (API key, language) hot-reload via the `settings:updated`
event — no restart needed. The conversation loop, Whisper language hint,
tray menu, and update dialog all re-render in the new language without
relaunching. Autostart only applies on next launch (handled by macOS).

### Manual model fetch

```bash
bash scripts/fetch-model.sh
```

### Debugging

The conversation worker runs in a hidden main window with devtools open in
debug builds. The Web Inspector's Console shows logs from both the renderer
(`[loop]` / `[timer]`) and Rust side (`[audio]` / `[whisper]` / `[openai]`),
unified through `lib/log-bridge.ts`.

### Dev binary signing

A Cargo runner at [`scripts/dev-codesign-run.sh`](./scripts/dev-codesign-run.sh)
re-signs the dev binary with the stable identifier `io.kkweb.chappie` before
launch (~0.4 s overhead). Without this, every rebuild produces a fresh random
signing identifier and macOS TCC can't track granted permissions across
rebuilds. (Even with this, screen-recording permission is still flaky in
dev — verify with a `pnpm tauri build` if it matters.)

## Usage

1. Click the menu-bar icon → **Settings**
2. Enter an API key (any of `sk-...` / `sk-ant-...` / `AIza...`); the detected provider name appears under the field
3. Pick a language (Auto = system locale)
4. Save
5. Say "**chappie, how are you?**" — or just "chappie", wait for the brief acknowledgement, then speak your message
   (The Japanese wake word "チャッピー" works too)

The menu-bar icon reflects the current state:

| State | Notes |
|---|---|
| initializing | Loading model / starting mic |
| idle | Listening for the wake word |
| listening | Capturing your follow-up |
| thinking | Whisper + LLM in flight |
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

Pure logic (state machine, conversation history, chat client wrapper,
wake-word detection, settings) is covered by Vitest unit tests. The audio
pipeline (cpal capture / Silero VAD / Whisper) and Tauri command bridges are
verified manually.

## License

MIT
