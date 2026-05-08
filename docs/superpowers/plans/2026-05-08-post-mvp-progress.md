# Chappie ポスト MVP 進捗ログ (2026-05-07 〜 2026-05-08)

v0.1.8 リリース後、「動くデモ」段階を超えてプロダクトに育てるための改善ログ。元の MVP プラン（`2026-05-06-chappie-mvp.md`）はクローズ済みで、ここからは継続改善のフェーズ。

## このフェーズで完了したもの

### 仕様の整備（"正常動作のための土台" 12 項目）

1. **TTS 中のマイクミュート** — `pause_listening` / `resume_listening` を Rust 側 `MUTED` AtomicBool で実装。`speak()` 完了後 350ms のクールダウン
2. **会話継続ウィンドウ** — 1 ターン後 6 秒間はウェイクワード不要で続けて話せる
3. **OpenAI を Rust 側に移動** — `openai.rs` で `chat_complete` コマンド。API キーが renderer の HTTP コードに乗らない
4. **Tool calling 基盤** — `end_conversation` / `get_current_time` を実装し、マルチラウンド実行ループを作成
5. **end_conversation で会話終了** — モデルが「またね」「ありがとう」を判定して呼び出す。継続ウィンドウをスキップ
6. **エラー状態の自動回復** — tray の error 状態は 1.8 秒で idle へ
7. **日本語 system prompt + Whisper 初期 prompt** — 「チャッピー」のウェイクワード認識率向上
8. **モデル選択 UI** — 設定画面に gpt-4o-mini / gpt-4o 等のセレクタ
9. **autostart クリーンアップ** — `tauri-plugin-autostart` を AppleScript 方式で
10. **ハルシネーションフィルタ強化** — 22+ パターン + 2 文字以下自動カット
11. **API キー未設定の起動チェック** — tray を error にして設定保存で auto-recover
12. **Acknowledgement「はい」** — ウェイクのみ検知時の確認発話（fire-and-forget）

### 体感改善 3 件

- **OpenAI streaming + 文単位 TTS** — `Channel<String>` でチャンク転送、`createStreamingSpeaker` が句点ごとに `speakQueued` 投入。発話開始までの遅延を半減
- **RMS ゲート** — Whisper 推論前に `rms < 0.003` のセグメントを破棄。静音ハルシネーションをコスト 0 で削減
- **Tool round-skip** — `end_conversation` のような marker tool かつ既に text がある場合、round 2 を省略

### ロギング統合

- `src-tauri/src/log_event.rs` — Rust → `log` イベントを emit する `linfo!` / `lwarn!` / `lerror!` マクロ
- `src/lib/log-bridge.ts` — renderer 側で `log` イベントを `console.info/warn/error` に転送
- → Web Inspector の Console タブだけで Rust + JS 両方のログを追える
- デバッグウィンドウは撤去（main window はヘッドレス worker `ConversationWorker.tsx` に置き換え）

### tool 拡張

- **`set_timer({ duration_seconds, label? })`** — `tokio::spawn` でカウントダウン、発火時に `timer:fired` イベント
- **`list_timers()`** — 残時間付きで一覧
- **`cancel_timer({ id? })`** — 個別 / 全件キャンセル
- 発火時 renderer 側で `pause_listening` + `speakQueued` で「タイマーです。時間です。」と読み上げ
- **`open_url({ url })`** — 既定ブラウザで URL を開く（http/https のみ受理）
- **`web_search({ query })`** — Google 検索 URL を組み立てて開く

### tray メニューからのマイク on/off

- `CheckMenuItem` で「マイクを有効にする」を追加。チェック外す＝`stop_listening` 呼出で cpal stream を破棄 → macOS のマイク使用中インジケータも消える
- `RUNNING` を `OnceCell` から `Mutex<Option<Arc<AtomicBool>>>` に変更。複数回 on/off を繰り返しても古い Arc を握り続けないように
- off 状態は専用アイコン (`tray-muted.png`) + 「Chappie: マイク入力オフ」ツールチップで明示

### 設定ウィンドウのフォアグラウンド化

- Accessory-mode（LSUIElement）アプリは新規ウィンドウが裏に出やすいので、`NSApp.activateIgnoringOtherApps:` を直接呼ぶ patch を追加（`objc2` 経由）。`set_focus()` だけでは前面に来ない

## 現在の構成（2026-05-08 時点）

### Rust (`src-tauri/src/`)

| ファイル | 役割 |
| --- | --- |
| `lib.rs` | Builder / プラグイン登録 / Tauri コマンド束ね |
| `tray.rs` | menu-bar tray（5 状態、メニュー: 設定 / 終了） |
| `model.rs` | Whisper モデル auto-download |
| `audio.rs` | cpal mic capture → rubato resample → Silero VAD → Whisper → `speech` イベント |
| `openai.rs` | streaming chat_complete + tool 実行ループ |
| `mic_permission.rs` | AVCaptureDevice.requestAccess（panic + NSException ガード） |
| `log_event.rs` | 中央集権的ログ（eprintln + emit "log"） |
| `timer.rs` | tokio ベースの in-memory タイマーマネージャ |

### Frontend (`src/`)

| ファイル | 役割 |
| --- | --- |
| `main.tsx` | `?view=settings` ルーティング、`installLogBridge()` 起動 |
| `views/ConversationWorker.tsx` | ヘッドレス worker（hidden main window 用） |
| `views/SettingsView.tsx` | 設定画面 |
| `hooks/useConversationLoop.ts` | mic 初期化 → speech listener → wake / body 判定 → chat_complete → TTS、`timer:fired` リスナー |
| `lib/openai-client.ts` | Rust IPC 薄ラッパ（`Channel<string>` で chunk 受領） |
| `lib/speech-synthesis.ts` | `speak` / `speakQueued` / `createStreamingSpeaker` |
| `lib/log-bridge.ts` | Rust の `log` イベント → renderer console |
| `lib/wake-word.ts` | NFKC + lowercase 正規化 + homophone tolerance |
| `lib/state-machine.ts` / `conversation-history.ts` / `settings.ts` | 純粋ロジック |

## 既知の課題

- **auto-update 後のマイク無音問題**（`memory/project_open_issues.md` 参照）— ad-hoc 署名の cdhash 変動による TCC ゴースト許可の疑い。長期解決は Apple Developer Program 加入だがユーザーは予定なし
- **エコーキャンセル / AGC** — cpal は生音、`ttsActiveRef` ベースの簡易抑制のみ。本格対応は `kAudioUnitSubType_VoiceProcessingIO`
- **ウェイクワードのバリアント** — small モデル化で homophone リストの再調整が未

## 次の方向性

`memory/project_roadmap_ideas.md` を参照。配布志向（一般ユーザに使ってもらう前提）が確定済み。次に積むべきは tool 拡張で「Chappie 何ができるの?」に答えられる粒度を増やすこと。

直近候補（コスト:体感）:

1. **`open_url` / `web_search`** — tauri-plugin-opener 経由、30 行クラス（小:中）
2. **`get_weather`** — Open-Meteo（key 不要）（小:中）
3. **`read_clipboard` / `write_clipboard`** — tauri-plugin-clipboard-manager（小:中）
4. **TTS 質感**（OpenAI TTS / VOICEVOX 置換）— 体感が一番化けるが API key 問題と絡む（中:大）
5. **API key 緩和**（自前バックエンド or ローカル LLM）— 配布の壁（大:大）

barge-in / 専用 wake word detector / 永続化メモリは上記が決まってから。
