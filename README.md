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

## Why Chappie?

The Alexa in the living room is shared with the family — not great for "remind
me to email my manager at 4" or "what's on my calendar tomorrow". Asking it
from your desk means the reply blares out of the kitchen speaker, three rooms
away. macOS's Siri exists, but you know how that goes.

Chappie is a hands-free voice assistant that lives on your Mac and only
listens to you. Keyboard stays where it is, the reply comes out of your
laptop, and the things you'd normally ask Alexa — timers, reminders, the
weather, "open my Downloads", "what song is this" — just work, one wake word
away.

## Highlights

- 🎙 **No hotkeys, no clicks** — just say the wake word; Chappie remembers the flow of the conversation
- 👤 **Only responds to your voice** — enroll once and Chappie ignores the TV, YouTube, and other people around you (on-device voiceprint, never uploaded)
- 🔒 **Your voice stays on your Mac** — speech is transcribed locally with Whisper; the raw audio never leaves the device
- 📍 **Locally-grounded replies** — weather and "nearby" questions pull from your actual area via macOS CoreLocation (with IP-based fallback if you decline the permission)
- 🔔 **Speaks up when it matters** — opt-in morning heads-up, a nudge before your next event, and sudden weather changes, without being asked. Choose whether it speaks aloud or just shows on screen.
- 🍎 **Menu bar resident, no Dock clutter** — shows up only when you need it
- 🌍 **9 languages** — Japanese / English plus Spanish / French / German / Italian / Portuguese / Korean / Simplified Chinese (Beta). Picks a matching macOS voice automatically. (The landing page itself currently ships in English and Japanese only.)
- 🆓 **No API key required** — Free mode works out of the box (5 chats/day via our hosted proxy). Bring your own OpenAI / Anthropic / Gemini key any time for unlimited use.
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
| ⚾ | MLB scores | Today's and yesterday's MLB games from the official feed. Knows which team each Japanese star plays for. "Any Ohtani game today?", "How did the Dodgers do?" |
| 📈 | Stocks & indices | Latest quotes for US / JP equities, major indices, and crypto via Stooq. "What's Apple at?", "How's the S&P doing?" (US equities ~15 min delayed) |
| 📐 | Unit conversion | Temperature / length / weight / volume / speed / area. "70°F in Celsius?", "5 miles in km?", "100 pounds in kg?" |
| 🖼️ | Wallpaper change | "Change my wallpaper to a forest" (Pixabay, a different photo per monitor), "Set today's picture of the day" (Wikimedia), "Set a famous painting" (Art Institute of Chicago). |
| 💡 | Smart home (SwitchBot) | "Turn on the living room light", "Turn off the AC", "Open the curtains". Controls your SwitchBot devices via the free Cloud API — enter your token & secret (from the SwitchBot app's Developer Options) in Settings. |
| 🗂 | Conversation memory *(experimental, opt-in)* | Remembers the flow of your conversations over weeks: drops natural references like "the meeting you mentioned last week" or "the ramen place you said you wanted to try". Daily summaries + semantic recall via a local embedding model (~470 MB, downloaded on first opt-in). Enable / disable / wipe from Settings. |
| 🔋 | Battery status | "What's my battery at?", "How much charge is left?" |
| 🔒 | Lock / sleep / stay-awake | "Lock the screen", "Put the Mac to sleep", "Stay awake for 30 minutes" |
| 📸 | Screenshot | "Take a screenshot", "Capture the whole screen and save it to my desktop" |
| 🕰 | World clock | "What time is it in London?", "Time in New York?" |
| 📰 | News | "What's the latest news?", "Tech news", "Nintendo news" (NHK / Hacker News / BBC + keyword search) |
| 📖 | Wikipedia | "What is ___?", "What happened on this day?", "Anything interesting nearby?" |
| 🚨 | Earthquakes | "Any recent earthquakes?", "Did it just shake?" (JMA feed) |
| 💱 | Currency | "What's USD/JPY?", "100 dollars in yen?" |
| 🌅 | Sun & moon | "What time is sunset today?", "Is tonight a full moon?" |
| 📄 | Read a web page | "Read the link in my clipboard", "Summarize this page" |
| 🌫️ | Air quality | "How's the air today?", "Is there dust?", "Is the UV strong?" (PM2.5 / dust / UV) |
| 🎌 | Public holidays | "When's the next holiday?", "Any holidays next month?" |
| 🌊 | Waves & surf | "How are the waves today?", "Is it surfable?" |
| 🌌 | Aurora & space weather | "Can I see the aurora tonight?", "Any geomagnetic storm?" |
| 📍 | Nearby landmarks | "Anything interesting nearby?", "What's around here?" |
| ✈️ | Planes overhead | "What plane is flying over me?", "Any planes overhead?" |
| 🛰️ | ISS location | "Where's the space station now?", "How high is the ISS?" |
| 🔴 | Pokémon | "What are Pikachu's base stats?", "What type is Charizard?" |
| 🏎️ | Formula 1 | "When's the next F1 race?", "Last race results?", "Driver standings?" |
| 🎬 | Anime | "How many episodes of Attack on Titan?", "What's Demon Slayer's rating?", "What's it about?" |
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
- **Audio preprocessing**: [`webrtc-audio-processing`](https://crates.io/crates/webrtc-audio-processing) (AGC2 / noise suppression / high-pass filter) on the 16 kHz mono stream before VAD — improves recognition in noisy rooms and at distance
- **Speaker recognition** *(optional)*: [WeSpeaker ECAPA-TDNN](https://huggingface.co/Wespeaker/wespeaker-ecapa-tdnn512-LM) (192-dim embedding) via [`tract-onnx`](https://crates.io/crates/tract-onnx). After enrollment, segments are scored by cosine similarity against the stored voiceprint and only the user's voice passes through to Whisper. Permissive bypass when not enrolled.
- **Speech-to-text**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs) (Rust, Metal-accelerated on macOS) using `ggml-small.bin`
- **Location grounding**: macOS CoreLocation via [`objc2-core-location`](https://crates.io/crates/objc2-core-location) when authorized (Wi-Fi-based, ~30-100 m + reverse-geocoded city name via `CLGeocoder`). Falls back to IP geolocation via [ipwho.is](https://ipwho.is) when not authorized — necessary because Japanese ISPs route most consumer IPs through Tokyo backbones, so an IP-only lookup tells Aichi/Osaka/Fukuoka users they're in Tokyo.
- **Wake-word matching**: renderer-side string match (NFKC normalization + Whisper homophone variants)
- **AI — three modes**:
  - **Free**: requests routed through `chappie.kkweb.io/api/chat` (Gemini 2.5 Flash, 5 requests/day/device, no setup). Daily quota resets at UTC 00:00.
  - **Pro** *(¥500/月)*: same proxy as Free but the daily cap is lifted, and the 8 paid VOICEVOX speakers (四国めたん, 春日部つむぎ, 冥鳴ひまり, 小夜/SAYO, 中国うさぎ, 東北ずん子, 東北きりたん, 東北イタコ) unlock. Magic-link sign-in (Supabase) + Stripe checkout, both driven from the Settings panel. Mutually exclusive with BYOK at the radio level, but premium-content entitlement is decided by `subscriptionStatus`, so a Pro subscriber who chooses BYOK still keeps the premium voices.
  - **BYOK**: bring your own key from OpenAI / Anthropic / Gemini for unlimited use. Provider auto-detected from the key prefix. Default models are each provider's cheapest tool-capable tier; override with `CHAPPIE_MODEL` env var.
  - In all three modes the HTTP call lives in Rust so the key (or device id / subscription token) never enters the renderer. Override the proxy URL with `CHAPPIE_PROXY_URL` for self-hosting.
- **Tools** (~40 native + ~21 MCP-contributed, multi-round tool calling in `openai.rs`):
  - **Native**: `set_timer` / `list_timers` / `cancel_timer` / `add_reminder_at` / `list_reminders` / `cancel_reminder` / `get_current_time` / `get_world_time` / `get_weather` / `open_url` / `open_youtube` / `close_youtube` / `web_search` / `open_app` / `open_finder` / `get_volume` / `set_volume` / `set_mute` / `control_music` / `get_now_playing` / `get_battery_status` / `read_clipboard` / `write_clipboard` / `take_screenshot` / `set_wallpaper` / `set_wallpaper_potd` / `set_artwork_wallpaper` / `list_switchbot_devices` / `switchbot_control` / `add_note` / `list_notes` / `delete_note` / `save_memory` / `recall_memory` / `list_memories` / `forget_memory` / `lock_screen` / `set_sleep_prevention` / `get_sleep_prevention` / `list_events` / `list_capabilities` / `end_conversation`
  - **MCP servers** (in-process, `mcp_<server>_<tool>`, all free / key-less): news (latest / search), wiki (summary / on-this-day / nearby), quake, fx, astro, fetch, mlb, stocks, units, airquality, aurora, holidays, marine, flights, iss, pokemon, f1, anime — see [docs/modules/rust-backend.md](docs/modules/rust-backend.md) for the full list
- **Conversation memory** *(experimental, opt-in)*: 3-layer long-term memory. **L1**: raw `~/.chappie/log/<date>.jsonl` of every turn, semantically indexed with [`multilingual-e5-small`](https://huggingface.co/intfloat/multilingual-e5-small) ONNX via tract (384-dim, 100+ languages incl. all 9 Chappie locales). **L2**: daily summaries generated by the same LLM that powers chat, written to `~/.chappie/summaries/`. **L3**: longitudinal topic / preference extraction from the last 30 days of summaries, refreshed weekly. All three layers feed the system prompt so the model can drop natural references without being mechanical. Embedding model is downloaded on first opt-in (~470 MB) and can be removed any time from Settings.
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

**Windows** — initial port (`x86_64-pc-windows-msvc`). The Rust backend and the
React/WebView renderer build and the system tools below are implemented against
Win32 / WinRT (`windows` crate): Core Audio for volume, `GetSystemPowerStatus`
for battery, `SetThreadExecutionState` / `SetSuspendState` / `LockWorkStation`
for sleep & lock, `IDesktopWallpaper` for wallpaper, GDI for screenshots, and
SMTC for media control. Whisper runs on the CPU backend (Metal is macOS-only).
The port has been built and compiled on Windows 11; end-to-end hardware
verification (mic capture, system voices, tray) is still in progress, so treat
the ✅ marks below as "implemented, verification pending". Two known gaps: the
WebRTC audio front end (AGC2 / noise-suppression / high-pass) is macOS/Unix-only
— its bundled C++ build isn't MSVC-compatible — so the Windows mic path runs
without it for now (quiet speech may need a louder voice or higher input gain);
and Calendar has no Windows equivalent (EventKit-only).

### Feature availability

| Feature | macOS | Windows |
| --- | --- | --- |
| Wake word + STT (Whisper) | ✅ | ✅ (CPU backend) |
| Speaker recognition (voiceprint, on-device) | ✅ | ✅ (no OS deps) |
| LLM chat (OpenAI / Anthropic / Gemini) | ✅ | ✅ |
| TTS (system voices) | ✅ | ✅ (WebView2 / SAPI) |
| Tray icon + states | ✅ | ✅ |
| Timers / reminders | ✅ | ✅ |
| Mic noise-suppression / AGC (WebRTC APM) | ✅ | ❌ (bundled build is Unix-only) |
| Volume control | ✅ | ✅ (Core Audio) |
| Screenshot | ✅ | ✅ (GDI; full-screen only, no marquee) |
| Music control (Spotify / Music.app) | ✅ | ✅ (SMTC, system-wide session) |
| Battery / sleep prevention / lock | ✅ | ✅ (Win32 power APIs) |
| Calendar (read-only) | ✅ (EventKit) | ❌ not planned for v1 |
| Location grounding (CoreLocation + IP fallback) | ✅ | ✅ (IP fallback only) |
| Clipboard / notes / open URL / open app / open Finder | ✅ | ✅ (Explorer / shell `start`) |
| Long-term memory (profile / preference / episode) | ✅ | ✅ (no OS deps) |
| Auto-update | ✅ | ✅ (NSIS) |

## Development

### Requirements

- macOS 14+ on Apple Silicon (M1 or later), **or** Windows 10/11 (x64) — see the table above for per-platform feature parity
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable toolchain)
- **Windows only:** Visual Studio C++ Build Tools (MSVC + Windows SDK), CMake, and LLVM/Clang — Whisper builds via CMake and the WebRTC-free mic path needs the MSVC toolchain. Install with:
  ```powershell
  winget install Rustlang.Rustup OpenJS.NodeJS.LTS Kitware.CMake LLVM.LLVM
  winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended"
  ```
  Build inside a "Developer PowerShell for VS 2022" (or after importing `vcvars64.bat`) so `cl.exe` / `link.exe` are on `PATH`, and set `LIBCLANG_PATH` to the LLVM `bin` directory.

### Setup & run

```bash
pnpm install
pnpm tauri dev
```

On first launch the Whisper `small` model (~466MB) is auto-downloaded to
`~/.chappie/models/ggml-small.bin`. Once it's ready the Chappie icon appears
in the menu bar. **Free mode is the default — just say "chappie" and start
talking.** If you want unlimited use, open **Settings** from the tray menu,
switch to "Use my API key", and paste a key from any supported provider
(OpenAI / Anthropic / Gemini).

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

1. (Optional) Click the menu-bar icon → **Settings** to pick a language or
   switch to your own API key. Free mode is the default.
2. Say "**chappie, how are you?**" — or just "chappie", wait for the brief
   acknowledgement, then speak your message. (The Japanese wake word
   "チャッピー" works too.)

### Free vs. own API key

|       | Free (default)   | Use my API key                              |
| ---   | ---              | ---                                         |
| Setup | None             | Paste key in Settings                       |
| Cap   | 5 chats / device | Unlimited                                   |
| Model | Gemini 2.5 Flash | OpenAI / Anthropic / Gemini (auto-detected) |
| Reset | UTC 00:00 daily  | —                                           |

Free mode shares Chappie's hosted proxy, so traffic counts against a
per-device daily quota. Switching to your own key talks directly to the
provider from Rust — the key never enters the renderer.

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

### macOS

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

### Windows

From a Developer PowerShell (so MSVC is on `PATH`) with `LIBCLANG_PATH` set:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\chappie.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
pnpm tauri build
```

Outputs the NSIS installer + its updater artifacts:

- `src-tauri/target/release/bundle/nsis/Chappie_<version>_x64-setup.exe`
- `src-tauri/target/release/bundle/nsis/Chappie_<version>_x64-setup.nsis.zip` + `.sig`

> The `bundle.targets` list is `["app", "nsis"]`; Tauri builds only the target
> valid for the host, so the same command produces a `.app` on macOS and an NSIS
> installer on Windows. To skip updater signing for a local test build, pass
> `--config '{\"bundle\":{\"createUpdaterArtifacts\":false}}'`.

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
