<div align="center">
  <img src="lp/public/hero.png" alt="Chappie" width="220" />

  # Chappie

  **「チャッピー」と呼びかけるだけ。あとは声だけで完結する。**

  メニューバーに常駐する、ハンズフリー音声 AI アシスタント for macOS

  🌐 [chappie.kkweb.io](https://chappie.kkweb.io) · 📦 [Latest release](https://github.com/piro0919/chappie/releases/latest) · 🦀 Tauri 2 + Rust + React

</div>

---

<div align="center">
  <img src="lp/public/menubar.png" alt="Chappie in the macOS menu bar" width="640" />
</div>

## Highlights

- 🎙 **ホットキーもクリックも不要** — 「チャッピー」と呼ぶだけで起動、会話の流れも記憶
- 🔒 **音声はあなたの Mac の中だけ** — 文字起こしはローカル Whisper、生音声がクラウドに出ない
- 🍎 **メニューバー常駐 / Dock を汚さない** — 必要な時だけ顔を出すアクセサリ常駐型
- 🗣 **macOS 標準の声を選べる** — 日本語・英語、男女自由に切り替え
- ♻ **自動アップデート** — 起動時に通知 → ワンクリックで最新版

## できること

| | できること | 例 |
|---|---|---|
| 💬 | おしゃべり | 「明日の予定、整理を手伝って」 |
| ⏲ | タイマー | 「3分タイマーかけて」「全部キャンセル」 |
| 🕐 | 時刻・日付 | 「今何時？」「今日は何曜日？」 |
| 👋 | 「またね」で待機モードに戻る | 「ありがとう、またね」 |

これからも少しずつ増えます。

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="lp/public/hero.png" alt="待機中の Chappie" width="120" /><br><b>待機中</b></td>
      <td align="center"><img src="lp/public/listening.png" alt="聞いている Chappie" width="120" /><br><b>聞いています</b></td>
      <td align="center"><img src="lp/public/talking.png" alt="喋っている Chappie" width="120" /><br><b>喋っています</b></td>
    </tr>
  </table>
</div>

## Architecture

- **Tauri 2** (Rust backend + WebView UI)
- **Mic capture & VAD in Rust**: [`cpal`](https://github.com/RustAudio/cpal) for input, [`voice_activity_detector`](https://crates.io/crates/voice_activity_detector) (Silero VAD V5) for utterance segmentation
- **Speech-to-text**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs) (Rust, Metal-accelerated on macOS) using `ggml-small.bin`
- **Wake-word matching**: renderer-side string match (NFKC normalization + Whisper homophone variants)
- **AI**: OpenAI Chat Completions (default `gpt-4o-mini`, switchable in Settings; HTTP call lives in Rust so the API key never enters the renderer)
- **Tools**: `set_timer` / `list_timers` / `cancel_timer` / `get_current_time` / `end_conversation` (multi-round tool calling in `openai.rs`)
- **Text-to-speech**: Web Speech API `SpeechSynthesis` (macOS native voices), streamed sentence-by-sentence as the model produces tokens
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

- macOS 14+ on Apple Silicon (M1 以降)
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

1. Click the menu-bar icon → **設定を開く**
2. Enter your OpenAI API key (`sk-...`) → Save
3. Say "**チャッピー、調子どう？**" — or just "チャッピー", wait for the "はい" ack, then speak your message

The menu-bar icon shows the current state:

| State | Tooltip | Notes |
|-------|---------|-------|
| initializing | 起動中 | Loading model / starting mic |
| idle | 待機中 | Listening for the wake word |
| listening | 聞いています | Capturing your follow-up |
| thinking | 考え中 | Whisper + OpenAI in flight |
| speaking | 喋っています | TTS playing the reply |
| error | エラー | See devtools console |

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
