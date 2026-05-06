# Chappie Desktop

ハンズフリー音声 AI アシスタント。ウェイクワード「**チャッピー**」（または `chappie`）で起動して声だけで会話できる、トレイ常駐型のデスクトップアプリ。

## Tech Stack

- **Tauri v2**（Rust バックエンド + WebView UI）
- **React 19 + Vite + TypeScript**（renderer）
- **pnpm**（パッケージマネージャ）
- **whisper-rs**（ローカル STT、macOS は Metal 加速）
- **`@ricky0123/vad-web`**（音声区切り検出）
- **OpenAI Chat Completions**（`gpt-4o-mini` ハードコード）
- **Web Speech API `SpeechSynthesis`**（TTS）

## Architecture

### Rust Backend (`src-tauri/src/`)

- `lib.rs` — メイン: Builder, plugin 登録, tray 初期化, Tauri command (`transcribe`, `set_tray_state`, `open_settings`, `ensure_model`)。Dock アイコン非表示 (`ActivationPolicy::Accessory`)、`tauri-plugin-single-instance` で多重起動防止
- `tray.rs` — メニューバー トレイアイコン (5 状態: idle/listening/thinking/speaking/error)。状態に応じてアイコン・ツールチップ・メニューを切替
- `model.rs` — Whisper モデル (`ggml-base.bin`) を `~/.chappie/models/` に自動 DL。`reqwest` でストリーミング、`model:progress` / `model:ready` イベント発火
- whisper コンテキストは `OnceCell<Mutex<WhisperContext>>` で常駐

### Frontend (`src/`)

- `main.tsx` — `?view=settings` で SettingsView、それ以外で ConversationView にルーティング
- `views/ConversationView.tsx` — 隠しウィンドウで動作する会話ワーカー UI（状態テキストのみ）
- `views/SettingsView.tsx` — トレイメニューから on-demand で開かれる設定ウィンドウ。OpenAI API キーと読み上げ音声を編集
- `hooks/useConversationLoop.ts` — VAD → whisper → ウェイクワード判定 → OpenAI → TTS → トレイ同期 のオーケストレーション
- `lib/state-machine.ts` — 純粋な状態機械 (idle/listening/thinking/speaking/error)
- `lib/conversation-history.ts` — 直近 20 メッセージの sliding window
- `lib/openai-client.ts` — OpenAI SDK の薄いラッパー
- `lib/wake-word.ts` — `chappie` / `チャッピー` + Whisper 同音バリアント (`チョッピー`/`Juppie` 等) の正規化マッチ
- `lib/speech-synthesis.ts` — `speechSynthesis.speak()` の Promise ラッパー
- `lib/settings.ts` — `tauri-plugin-store` の薄いラッパー

## Key Design Decisions

- **whisper-rs を Rust 側で持つ**: 当初 `@xenova/transformers` の WebGPU/WASM Whisper を検討したが、レンダラ占有が大きく Mac の Metal を活かせないため Rust 側に移管
- **VAD はレンダラ常駐**: `@ricky0123/vad-web`（軽量、CPU 1-2%）。発話区切り検出時に PCM (Float32Array) を Tauri command で Rust に渡す
- **ウェイクワード判定はレンダラの文字列マッチ**: Whisper 結果の正規化 (NFKC + lowercase) 後に部分一致。`chappie`/`チャッピー` + 同音バリアントを許容
- **TTS 中は VAD pause**: 自分の TTS 音声でセルフトリガーするのを防ぐ
- **設定変更は再起動で反映**（MVP）: `settings:updated` イベントで即時反映する経路もあるが、シンプルさ優先
- **Whisper 初期プロンプトでバイアス**: `set_initial_prompt("チャッピー、はい、チャッピーです。")` で base モデルに「チャッピー」という単語を教え込み、認識精度を確保
- **テンプレートアイコンではなくフルカラー**: 状態を色で示す UX を優先（macOS テンプレート方式は単色で形でしか状態表現できない）
- **メイン window は非表示**: 会話ワーカーは hidden な main window で動作、ユーザーは tray アイコンとオンデマンド Settings ウィンドウのみで操作

## Build & Distribute

### 開発

```bash
pnpm install
bash scripts/fetch-model.sh     # 初回のみ Whisper base モデル取得（150MB）
pnpm tauri dev
```

### リリースビルド（重要：環境変数必須）

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/chappie.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
APPLE_SIGNING_IDENTITY="-" \
pnpm tauri build
```

- `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD`: updater 用 minisign 署名（無いと自動更新が壊れる）
- `APPLE_SIGNING_IDENTITY="-"`: ad-hoc コード署名。**これを忘れると配布後 macOS で「壊れている」エラーになる**

成果物:
- `src-tauri/target/release/bundle/macos/Chappie.app`
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz`（updater 配信用）
- `src-tauri/target/release/bundle/macos/Chappie.app.tar.gz.sig`（minisign 署名）

### リリース（GitHub Release 公開 + updater エンドポイント更新）

1. `package.json` と `src-tauri/tauri.conf.json` のバージョンを更新
2. 上記の環境変数付きで `pnpm tauri build`
3. `pnpm release` — GitHub Release 作成 + .app.tar.gz / .sig / latest.json をアップロード
4. updater エンドポイント `https://github.com/piro0919/chappie-desktop/releases/latest/download/latest.json` が次回起動時に新バージョンを案内する

## Spec & Plan

- 設計書: `docs/superpowers/specs/2026-05-06-chappie-design.md`
- 実装プラン: `docs/superpowers/plans/2026-05-06-chappie-mvp.md`（Task 1-8、進捗は checkbox で管理）
