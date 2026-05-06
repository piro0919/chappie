# Chappie Desktop

ハンズフリー音声 AI アシスタント。ウェイクワード「**チャッピー**」で起動して声だけで会話できる、トレイ常駐型のデスクトップアプリ。

## アーキテクチャ

- **Tauri 2** (Rust 製バックエンド + WebView UI)
- **音声区切り検出**: [`@ricky0123/vad-web`](https://github.com/ricky0123/vad)
- **STT**: [`whisper-rs`](https://github.com/tazz4843/whisper-rs)（Rust 側、macOS は Metal 加速）
- **ウェイクワード判定**: 文字列マッチ（renderer 側、NFKC 正規化 + 同音バリアント許容）
- **AI**: OpenAI Chat Completions（`gpt-4o-mini`）
- **TTS**: Web Speech API `SpeechSynthesis`（OS 標準ボイス）
- **設定永続化**: `tauri-plugin-store`

## 開発

### 必要なもの

- macOS 13+ または Windows 10+
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)（Tauri ビルドに必要）

### セットアップ & 起動

```bash
pnpm install
pnpm tauri dev
```

初回起動時に Whisper の base モデル（約 150MB）が `~/.chappie/models/ggml-base.bin` に自動ダウンロードされます。完了するとメニューバーにチャッピーのアイコンが現れ、「設定を開く」から OpenAI API キーを登録すると会話できるようになります。

> 設定変更（API キー・読み上げ音声）はアプリの再起動後に反映されます（MVP）。

### モデルを手動取得したい場合

```bash
bash scripts/fetch-model.sh
```

## 使い方

1. メニューバーのチャッピーアイコンを右クリック →「設定を開く」
2. OpenAI API キー（`sk-...`）を入力 → 保存 → アプリを再起動
3. 「**チャッピー、おはよう**」と話しかける（または「チャッピー」だけ言って一拍置いてから本文）

メニューバーアイコンの色で状態がわかります：
| 状態 | 色 |
|---|---|
| 待機中 | グレー |
| 聞いてる | 水色 |
| 考え中 | 黄色 |
| 喋ってる | 緑 |
| エラー | 赤 |

## ビルド

```bash
pnpm tauri build
```

成果物：
- macOS: `src-tauri/target/release/bundle/macos/Chappie.app`（配布は zip 圧縮で）
- Windows: `src-tauri/target/release/bundle/nsis/Chappie_<version>_*-setup.exe`

> macOS の DMG バンドラ (`bundle_dmg.sh`) は AppleScript で Finder ウィンドウを操作するため CI 等の非対話環境ではハングする。MVP では `.app` 直接配布を推奨。
>
> 署名・公証（notarization）は未対応。macOS では初回起動時に右クリック →「開く」で Gatekeeper をバイパスしてください。

## テスト

```bash
pnpm test:run    # 1 回実行
pnpm test        # watch モード
```

純ロジック（state machine / 会話履歴 / OpenAI クライアント / ウェイクワード / 設定）は Vitest で単体テスト。VAD / Whisper / TTS / Tauri command を絡める部分は手動検証です。

## ライセンス

MIT
