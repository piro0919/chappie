# カレンダー連携（読み取り専用）設計

- 起票日: 2026-05-09
- 関連メモ: `project_roadmap_ideas.md`（tool 拡張フェーズ、カレンダー連携は galopen 統合候補として記載）
- 参照実装: `~/Repository/galopen/src-tauri/src/calendar.rs`

## 目的

Chappie に「今日の予定は？」「明日のスケジュール教えて」「次の予定は？」を音声で完結させる能力を追加する。voice-first ランチャーとしての存在意義（roadmap の壁 #4）を一段押し上げ、既存の reminder / timer / notes / now-playing と同じ列に並べる。

書き込み（add / update / delete）は本スペックでは扱わない。音声だけでイベント特定や日時補正をさせる UX 設計が重く、誤登録のリカバリも面倒なため、まず読み取りで体験を固める。

## スコープ

含む:
- macOS EventKit から今日 / 明日 / 直近の予定を取得する 1 本の tool
- 初回権限プロンプト（マイク・画面収録と同じ「常に requestAccess を呼ぶ」鉄則）
- Settings UI のカレンダー権限ボタン
- `capabilities.rs` への例文追加
- i18n ラベル
- LP / README / CLAUDE.md の同期更新

含まない:
- イベントの追加 / 更新 / 削除
- 複数カレンダーの選別 UI（全カレンダー横断で返す）
- macOS Reminders App 連携（用途が `reminder.rs` と被る）
- Google / Outlook 等の外部カレンダー連携

## アーキテクチャ

### 新規ファイル: `src-tauri/src/calendar.rs`

galopen の `calendar.rs` を chappie のスタイルに合わせて移植する。要点:

- `EKEventStore` は `Send` / `Sync` でないため、起動時に専用 OS スレッドを 1 本立て、`mpsc::channel` でコマンドを送受信する。
- 全 EventKit 呼び出しを `std::panic::catch_unwind` + `objc2::exception::catch` で二重にガード（mic_permission.rs と同じ鉄則）。エンタイトルメント不整合等で NSException が出てもプロセスを巻き込まない。
- 状態は `OnceCell<CalendarState>`（`tray.rs` の `UPDATE_AVAILABLE` と同様の global シングルトン）。
- 公開 API:
  - `init(app: &AppHandle)` — スレッド起動。`lib.rs` の setup から呼ぶ。
  - `request_access() -> Result<bool, String>` — 権限ダイアログ。`AVCaptureDevice.requestAccessForMediaType:` と同じく **status を見ずに常に request を呼ぶ**。
  - `current_status() -> Result<&'static str, String>` — Settings UI のバッジ表示用（"granted" / "denied" / "not_determined" / "restricted"）。
  - `fetch_events(range: Range) -> Result<Vec<CalendarEvent>, String>`
- Range:
  - `Today` — 現在時刻から今日終端（ローカルタイム 23:59:59）まで。
  - `Tomorrow` — 明日 00:00:00 〜 23:59:59。
  - `Upcoming` — 現在時刻から 7 日後までで先頭 10 件。
- 返却件数は最大 10 件（音声前提のため絞る）。
- 返却フィールド: `id, title, start, end, location, is_all_day, calendar_name`。description / url / attendees は voice では使わないため落とす。日時はローカル ISO8601 文字列（`2026-05-09T14:30:00+09:00`）に正規化し、LLM 側で読み上げ表現に変換させる。

### Tauri Command 層

`lib.rs` に下記コマンドを追加し `invoke_handler` に登録:

- `request_calendar_access() -> Result<bool, String>` — Settings UI から呼ぶ。
- `calendar_status() -> Result<String, String>` — Settings UI 表示用。
- 内部用の `fetch_events` は LLM tool 側からのみ呼ぶため Tauri command としては露出しない（`openai::execute_tool` から直接 `calendar::fetch_events` を呼ぶ）。

### LLM Tool 定義（`openai.rs`）

`all_tools()` に `list_events` を追加:

```text
name: list_events
description: ユーザーのカレンダーから予定を取得する。
parameters:
  range: enum["today", "tomorrow", "upcoming"]   // 必須
```

`execute_tool` に分岐を追加し、`calendar::fetch_events` を呼んで JSON 文字列で返す。`gemini.rs` / `anthropic.rs` は `openai::all_tools()` / `execute_tool` を共有しているため変更不要。

権限未許可時の返り値は `{ "error": "permission_denied", "hint": "設定からカレンダー権限を許可してください" }` 形にし、LLM が「設定から許可してね」と案内できるようにする。

### Permission 設定

- `src-tauri/Entitlements.plist` に `com.apple.security.personal-information.calendars` を追加。
- `src-tauri/Info.plist` に `NSCalendarsFullAccessUsageDescription`（macOS 14+ 想定。古い OS は `NSCalendarsUsageDescription` も併記して互換）。
- 文言: `"Chappie が予定を読み上げるためにカレンダーへアクセスします。"` 相当（i18n 同期）。

### Settings UI

`SettingsView.tsx` のマイク・画面収録ブロックの直下に「カレンダー」ブロックを追加:

- ボタン押下 → `request_calendar_access` 呼び出し → 結果を `calendar_status` で再取得してバッジ更新。
- バッジ: granted（緑） / denied（赤） / not_determined（灰）。
- 文言は `i18n/messages.ts` 経由（9 言語ぶん追加）。

### `capabilities.rs`

カレンダーカテゴリを 1 件追加し、例文 3 つを登録:
- 「今日の予定は？」
- 「明日のスケジュール教えて」
- 「次の予定は？」

`list_capabilities` 経由で「何ができるの？」の回答に自動で乗る。

### i18n

`src/i18n/messages.ts` に下記キーを 9 言語ぶん追加:
- `settings.calendar.title`
- `settings.calendar.description`
- `settings.calendar.requestButton`
- `settings.calendar.statusGranted` / `Denied` / `NotDetermined`

### 依存追加

`src-tauri/Cargo.toml`:
- `objc2-event-kit = "0.x"`（galopen で使用中のバージョンを揃える）

`objc2` / `objc2-foundation` / `block2` は既存依存で足りる想定。

## データフロー

```
User: "今日の予定は？"
  → Whisper → useConversationLoop → chat_complete (Rust)
  → LLM が list_events(range="today") を tool_call
  → openai::execute_tool → calendar::fetch_events(Today)
  → mpsc コマンド → 専用スレッド上で EKEventStore::predicateForEventsWithStartDate:endDate:calendars:
  → Vec<CalendarEvent> を JSON 化して LLM に返す
  → LLM が「今日は14時から打ち合わせ、それから……」と発話文を生成
  → 既存の TTS / HUD ルーティング（is_muted で分岐）
```

## エラーハンドリング

- 権限未許可: tool 結果に `{ error: "permission_denied", hint }` を返し、LLM に案内させる。
- スレッド側 panic / ObjC exception: 二重ガードで握りつぶして `Err(String)` を返す。LLM には `{ error: "calendar_unavailable" }` として渡す。
- 0 件: 空配列を返す。LLM が「今日は予定ないよ」相当を生成する。

## テスト方針

EventKit の自動テストは難しいため手動確認ベース:

1. 権限未許可状態で「今日の予定は？」→ Settings へ案内する発話 / HUD 表示を確認。
2. 権限許可後、実機カレンダーに 0 件 / 1 件 / 複数件 / 終日イベント / 当日跨ぎイベント のケースで読み上げ品質を確認。
3. ミュート時に HUD で同じ内容が表示されることを確認（既存ルーティングに乗るだけだが回帰防止）。
4. 各プロバイダ（OpenAI / Gemini / Anthropic 動作確認済み・xAI / OpenRouter は memory の動作確認状況に従いベストエフォート）で tool_call が走ることを 1 回ずつ確認。

## 周辺ドキュメント同期（feedback メモ準拠）

実装と同じ PR / コミット系列で以下も更新する:

- `CLAUDE.md` の Rust Backend / Frontend / 主要設計判断セクションに `calendar.rs` を追記。
- `README.md` の機能一覧と「できること」例文に追加。
- LP（`landing-page/` 配下）の例文セクションに `capabilities.rs` と整合する形で追加。
- memory `project_roadmap_ideas.md` の完了リストへ移動。
- memory `project_provider_test_status.md` を本機能の検証結果で更新。

## オープンクエスチョン

- macOS 13 以前のサポート要否。現状 chappie の最低 OS は明示されていない。実装時に `tauri.conf.json` の `minimumSystemVersion` を確認し、14 未満を許容するなら `NSCalendarsUsageDescription` も併記する。
