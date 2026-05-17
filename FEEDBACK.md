# Chappie フィードバック

Rust約12,700行 + TypeScript約7,000行、Rustモジュール40本超。個人開発のmacOS音声AIアシスタントとして、技術的な深さと作り込みが本物の作品です。「Alexaをパソコンで実現したい」という出発点が、コードの全体設計に一貫して反映されています。

## 良い点

### 1. 技術スタックの選択と統合

- **ローカルWhisper + 声紋認証 + LLM統合 + macOS native**を全部Rustで束ねている。AIラッパー層ではなく、OS統合層で勝負している
- cpal + Silero VAD + WebRTC APM（AGC2 / NS / HPF）+ whisper-rs + ECAPA-TDNN（tract-onnx + kaldi-fbank）、CoreLocationのobjc2による直叩き、EventKit経由のカレンダー読み取り、と各レイヤーの選定が適切
- 3プロバイダLLM（OpenAI / Anthropic / Gemini）のSSE + プロンプトキャッシュ最適化が全部実装されている。これは個人開発で珍しい

### 2. 実装に残る`実際にハマって直した`痕跡

- **`embedding.rs`のtract最適化注記**：固定seq_lenで`into_optimized()`を回すとattention_maskが機能せず、cosine 0.9998の同一埋め込みが出る、というハマりがコメントで明文化されている。これは動かして潰した証拠
- **`conversation-history.ts`の`MAX_NON_SYSTEM = 4`**：Gemini 2.5 Flashの直近ツール呼び出しコンテキスト汚染（前ターンで`get_battery_status`が成功すると次の「タイマーセット」も同じツールに引き戻される）を実測で発見してから刻んだ値
- **`wake-word.ts`の多言語Whisper誤聞き取りバリアント**：独語の`tschappi`、中国語`恰比/查皮/夏皮`、韓国語`채피/찹피/차피`まで網羅。最早出現位置 + 最長一致のタイブレーク、敬称サフィックス除去

### 3. プロンプトキャッシュの実装

- Anthropic：`cache_control: { type: "ephemeral" }`を明示
- OpenAI：自動キャッシュ + `stream_options.include_usage`でcached_tokens観測
- Gemini：暗黙キャッシュの`cachedContentTokenCount`をログ
- 3層メモリ（L1 RAG / L2 daily summary / L3 weekly topics）を変更頻度の低い順に並べてプレフィックス安定化、locationグラウンディングを静的personaの後に挿入してキャッシュヒット率を維持、までやっている。これは商用SaaSと同じレベルのコスト意識

### 4. AECではなく声紋認証という設計判断

`docs / CLAUDE.md`に明示されている通り、AECは`Chappieの出力`しか消せず、TVや他人の声には効かない。ECAPA-TDNN（25MB、192次元）1つで全部の異音源を弾ける、という判断は理屈として正しいし、`AGCをbarge-in中にバイパスしないとTTSエコーが自己発振ループになる`という追加の落とし穴まで対処済み。

### 5. ad-hoc署名 + LSUIElement + Accessoryでのマイク許可問題の解決

`CLAUDE.md`の`macOSマイク許可`セクションは、過去の失敗から学んだルールが明文化されている。`requestAccess`を常に呼ぶ、専用スレッドから呼ぶ、`block2::RcBlock`で受ける、という3点が確立されている。これは多くのTauri開発者が踏むであろう地雷の回避策で、リファレンス価値があります。

### 6. ゴールデンテスト

`src-tauri/tests/golden_tool_routing.rs`と`scripts/test-tool-routing.mjs`の2層構成で、ツール選択の回帰を検出できる仕組みがある。`実LLMプロバイダに投げる`ことを許容している割り切りも適切（モックではLLMの実挙動を検証できない）。

## 改善の余地

### 1. `state-machine.ts`がプロダクト全体の複雑度に対して薄すぎる

`src/lib/state-machine.ts`は5状態（idle / listening / thinking / speaking / error）のswitch文38行です。Chappie全体の複雑度（音声入力 + 声紋ゲート + Whisper + LLM + ツール実行 + TTS + barge-in + 継続ウィンドウ + ミュート分岐 + HUD分岐）に対して、オーケストレーション層がほぼ存在していません。

状態遷移ロジックの大半は`useConversationLoop.ts`の中に散らばっていると推測されます。これは将来、

- 新しい状態（例：tool実行中、認証中、モデルダウンロード中）を追加する時のリグレッション源になる
- バグの原因究明が困難になる（状態がどこで変わったかを追えない）
- テストカバレッジが低くなる（純粋関数として隔離されていない）

ことが懸念されます。`xstate`や`zustand`のような状態管理ライブラリは過剰かもしれませんが、現状の`State`型を拡張して、`thinking`の中に`callingTool` / `awaitingToolResult`等のサブ状態を持たせるだけでも、堅牢性が大きく上がります。

### 2. 38ツールがキッチンシンク化する懸念

`screenshot` / `music` / `caffeinate` / `lock_screen` / `clipboard` / `notes` / `memory` / `battery` / `weather` / `calendar` / `volume` / `set_mute` / `open_finder` / `open_url` / `open_app` / ... と並んでいて、ツール数の絶対値が38を超えています。

問題は、

- **実際に使われているツールが分からない**：使用ログがないため、削るべきツールが見えない
- **LLMのプロンプトトークンが膨らむ**：ツール定義は毎回送られるため、プロンプトキャッシュが効くとはいえベース消費は増える
- **ツール選択精度が落ちる**：選択肢が多いほどLLMが間違いやすい（特にGemini Flashで顕著、と本人もコメントで言及済み）

`session_log.rs`にツール実行ログがあるなら、月次で集計して使用頻度ゼロのツールを削除する運用があるとよいです。なければ、`tool_usage.rs`のような軽量カウンタを追加して、ローカルにログを残す仕組みを検討してください。

### 3. READMEの「なぜ作ったか」が機能リストに埋もれている

`Highlights`セクションがいきなり機能リストから始まっていて、`なぜAlexaやSiriではなくChappieが必要なのか`が伝わりません。「Alexaをパソコンで実現したい」という出発点は会話で聞いて初めて分かったもので、READMEからは読み取れない。

例えば冒頭に、

> 家のAlexaは家族と共有しているから自分専用のことは頼みづらい。仕事中にAlexaに話しかけるとリビングのスピーカーで返事が来る。macOSのSiriは音声アシスタントとして弱い。だからパソコンで完結する自分専用のAlexaが欲しかった。

のような3〜4行のストーリーがあるだけで、`Hacker News` / `r/macapps` / `r/LocalLLaMA`での反応が変わります。技術カタログより、不便の言語化のほうが届きます。

### 4. Free modeの`device-id`認証の脆弱性

`device_id.rs`の方式は、`~/.chappie/device-id`ファイルを削除すればクォータがリセットされる、と本人もコメントで認識しています。

これはMVPとしては許容範囲ですが、`チャッピーのフリーモードはどこまで信用していいのか`が公開仕様として明確でないと、配布スケールが上がった時に悪用される可能性があります。

短期的には、デバイスIDをハードウェア由来（macOSのIOPlatformUUID）にすることで、ファイル削除での回避が一段難しくなります。長期的にはSign in with Vercel / Apple ID等の本格的な認証に置き換える計画を、`docs/auth-roadmap.md`のような形で明文化しておくと、透明性が増します。

### 5. テストカバレッジの偏り

`src/lib/`にはテストがそれなりにありますが（`state-machine.test.ts`、`wake-word.test.ts`、`speech-filters.test.ts`等）、`src-tauri/src/`のRust側は`tests/`にゴールデンテストがあるのみで、各モジュールの単体テストが見当たりません。

特に、

- `speaker.rs`の埋め込み計算と類似度判定
- `rag.rs`のcosine類似度フィルタリング
- `summarizer.rs`の日付バックフィル
- `reminder.rs`の再帰スケジューリング（DST跨ぎ、月末ロールバック）

あたりは、回帰しやすく、かつバグると体感品質を大きく落とすポイントです。Rustの`#[cfg(test)]`モジュールで最低限のスモークテストを書いておくと、リファクタリング時の安心感が変わります。

### 6. `CLAUDE.md`が肥大化している

`CLAUDE.md`は情報量が豊富で価値が高いですが、現状で40モジュール分の解説が1ファイルに集約されており、検索性が落ちています。

将来的には、

- `CLAUDE.md`：プロジェクト全体の設計判断と原則
- `docs/modules/audio.md` / `docs/modules/llm.md` / `docs/modules/memory.md`：レイヤー別の詳細

のように分割すると、Claude Codeに作業させる時のコンテキスト指定も最適化できます。

### 7. `summarizer.rs`の`maybe_backfill`がchat_completeから呼ばれている

サマリー生成がチャットの裏で走ると、ユーザーの体感速度に影響する可能性があります。`maybe_backfill`は`tokio::spawn`で完全に非同期化するか、起動時の1回だけにする等、チャットのクリティカルパスから外したほうが安全です（既にそうなっているなら無視してください）。

## 総評

個人開発のmacOSデスクトップアプリとして、Chappieは間違いなく上位のクオリティです。AI時代に量産されているAPIラッパー系アシスタントとは明確に違う層の作り込みで、`ローカル処理 + macOS統合 + 多プロバイダLLM`の組み合わせを1人で束ね切っている点で、技術的な貢献度も高いです。

ただし、現状のChappieは`スコープが広がりすぎている`兆候も見えます。ツール38個、メモリ層3階、9言語対応、複数プロバイダ統合、声紋認証、CoreLocation、EventKit、MCPレジストリ、と全部を1人でメンテナンスし続けるのは、長期では持続性に懸念があります。

優先度の高い改善は、

1. **`state-machine.ts`の表現力強化**：オーケストレーションの脆弱性が一番の技術的負債
2. **READMEのストーリー化**：「Alexaをパソコンで」の出発点を冒頭に
3. **ツールの使用ログ収集と削減**：キッチンシンク化を防ぐ

の3点です。それ以外は、すでに十分高い品質です。
