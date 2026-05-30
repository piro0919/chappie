# 運用保守リスク棚卸し

> 初版: 2026-05-30 / 対象バージョン: v0.21.0
>
> 運用保守（外部依存・障害耐性・保守容易性）の観点で気になる箇所を、重み（影響 × 発生確度）付きで列挙したもの。コードへの修正はまだ入れていない「洗い出し」段階のメモ。各項目に根拠の `file:line` を添えてある。

## 優先度サマリ

| # | 箇所 | 重み | 一言 |
|---|------|:---:|------|
| 1 | LP プロキシの単一 Gemini キー / 単一経路 | **高** | Free+Pro 全員の SPOF |
| 2 | モデル ID のハードコード（Desktop & LP 両方） | **高** | 廃止時に再ビルド＋再デプロイ必須、ユーザー側に逃げ道なし |
| 3 | 無契約フリー外部 API 約35本 | **高** | 1本落ちると該当 tool がサイレント故障 |
| 4 | `download.rs` にタイムアウト・リトライ無し | 中 | 466MB DL が stall で永久ハング |
| 5 | `tools.rs` 82KB / `capabilities.rs` 74KB | 中 | 認知負荷・マージ衝突源 |
| 6 | golden / multi-turn テストが有料・手動・CI 除外 | 中 | tool routing 回帰がすり抜ける |
| 7 | 9言語 i18n + persona の手動同期 | 中 | drift 必至（test script に複製あり） |
| 8 | リリース手順の手作業 | 中 | version 2箇所手動、env 焼込み事故の既往 |
| 9 | 端末側エラーの集約観測が無い | 中 | tool 失敗を検知する手段がない |
| 10 | `unwrap/expect` が background 系に集中 | 低 | panic でスレッド/タスク停止 |
| 11 | http クライアント方針の不徹底 / `.part` 後始末なし | 低 | 規約は明文化済みだが download が逸脱 |

最優先は **#1（プロキシ/キーの SPOF）と #2（モデル ID 二重ハードコード）**。どちらも「外部要因（Google のキー絞り・モデル廃止）で全ユーザーが同時に止まり、復旧に再デプロイ／再配布が要る」型で、影響と復旧コストの両面で重い。

---

## 高（運用が広範に止まりうる）

### 1. プロキシが全 Free+Pro ユーザーの単一障害点

`lp/src/app/api/chat/route.ts:31-106` — Free も Pro も**同一の `GEMINI_API_KEY` 1本・同一モデル・同一ルート**を通る。

- このキーが Google にスロットル／失効されると、BYOK 以外の全ユーザーが同時停止。`src-tauri/src/provider.rs:42-43` のコメントどおり「アカウント単位で公称より低く絞られる（〜20 RPD）」事象が起きれば、課金中の Pro まで巻き添え。
- upstream `fetch`（`route.ts:102`）に `AbortController`/タイムアウトが無く、`maxDuration = 300` 任せ。Gemini が握ったまま遅延すると 5分占有。
- 副次: Pro はモデルが Free と同一で「上限が無いだけ」。品質差で売れない構造で、Pro の価値訴求が将来詰む可能性（事業設計メモ）。

**対応案**: キー複数化＋ローテーション、upstream タイムアウト、429/5xx 時のフォールバック経路。

### 2. モデル ID のハードコードが二重化

`src-tauri/src/provider.rs:50-52`（`gpt-4o-mini` / `claude-haiku-4-5` / `gemini-2.5-flash`）、`src-tauri/src/openai.rs:118`、`lp/src/app/api/chat/route.ts:11`、`src/hooks/useConversationLoop.ts:67` に散在。

`gpt-4o-mini` と `gemini-2.5-flash` は具体スナップショット名なので、廃止時に **Desktop 再ビルド＋全ユーザー再配布**が必要。設定 UI にモデルピッカーが無いため、ユーザー側に `CHAPPIE_MODEL` 以外の逃げ道がない。`claude-haiku-4-5` は可動エイリアスなのでマシ。

**対応案**: モデル ID をサーバ（LP）側設定に寄せ、Desktop は「プロキシ任せ」を基本に。BYOK 直叩きの分だけ最小ハードコードに留める。

### 3. 無契約フリー外部 API への広範な依存

`src-tauri/src` 内に約35エンドポイント。`ipwho.is` / `stooq.com` / `pokeapi.co` / `jma.go.jp` / `hnrss.org` / `opensky-network.org` / `wheretheiss.at` / `date.nager.at` / `open.er-api.com` / `sunrise-sunset.org` / `services.swpc.noaa.gov` / `api.jikan.moe` / `api.artic.edu` …いずれも SLA 無しの無料公開 API。

- 各々が「ある日仕様変更/停止」してもアプリは気づけない（#9 と複合）。
- SwitchBot は CLAUDE.md 明記どおり「JP 居住回線以外をブロック」で CI 検証不能、実機頼み。

**対応案**: tool 失敗率テレメトリ、主要 tool への二次ソース、health-check 定期巡回。

---

## 中

### 4. `download.rs` のタイムアウト・リトライ欠如

`src-tauri/src/download.rs:41` が `reqwest::get(url)` で**デフォルトクライアント＝タイムアウト無し**。ストリーム途中で停滞すると永久に待つ（whisper 466MB / e5 470MB / WeSpeaker 25MB）。リトライも無し。
`.part`→`rename` のアトミック性は `download.rs:46-71` で担保済み（ここは問題なし）。追加でサイズ／チェックサム検証が無く（`content_length` を受信量と突き合わせない）、失敗時に `.part` が残置。

**対応案**: `connect_timeout` + 進捗 stall 検知、N回リトライ、DL 後のサイズ照合。

### 5. 巨大単一ファイル

`tools.rs` 82KB / `capabilities.rs` 74KB。tool が増えるほど膨張し、レビュー・マージ衝突・認知負荷が悪化。MCP レジストリ化の方針があるので native tool 群も分割余地あり。

### 6. tool routing テストが有料・手動・CI 除外

golden（$0.10-0.15/回）と `test:multi-turn` は手動運用で CI 非実行（CLAUDE.md 記載）。tool 定義や persona を触ったとき回し忘れると、Free の 5回/日制約下で最も痛い「誤 tool 選択」回帰が素通り。MEMORY に「Gemini で escape 不発」の実測あり。

**対応案**: ネットワーク不要の routing スモーク（rescue/chitchat 分類のユニット）を CI 必須化。

### 7. 9言語 i18n + persona の手動同期

persona は `src/i18n/messages.ts` と `scripts/test-tool-routing.mjs` に**インライン複製**（CLAUDE.md 明記）、affinity stance / muted 指示も各ロケール手書き。keyword 辞書も JP/EN のみ comprehensive。drift しやすく検知手段なし。

**対応案**: persona の単一ソース化（テスト側は import）、ロケール網羅 lint。

### 8. リリース手順の手作業性

version を `package.json` と `src-tauri/tauri.conf.json` の2箇所で手動 bump。`latest.json` 生成は node ワンライナー、minisign 鍵は手元管理。MEMORY 記載の **v0.12.4「`.env.local` の `VITE_*` 焼込みで全ユーザー /api/me 死亡」**が手順依存ゆえ再発しうる。

**対応案**: version 同期＋本番ビルド時 env 隔離をスクリプト/CI で強制。

### 9. 端末側エラーの集約観測が無い

`src-tauri/src/log_event.rs` / `src/lib/log-bridge.ts` はあるが、Sentry 等のクラッシュ/エラー集約が無く、analytics は opt-in かつ tool 名のみ。端末で tool が静かに失敗しても運用側は気づけない（#3 と複合）。

---

## 低（局所的だが要注意）

### 10. `unwrap/expect` が background 系に集中

`reminder.rs`(12) / `memory.rs`(9) / `timer.rs`(7) / `notes.rs`(7)。tokio タスク内なら当該タスク死で済むが、`audio.rs`(5) はキャプチャ系スレッドで panic するとマイクが落ちる可能性。`tray.rs` は2件と健全。

**対応案**: 少なくとも audio/timer 系は `Result` 伝播へ。

### 11. http クライアント方針の不徹底 / `.part` 後始末

`src-tauri/src/http.rs` で「各モジュール専用クライアント（タイムアウト付き）」方針が明文化されているが、`download.rs` だけ素の `reqwest::get` で逸脱（#4）。`miniplayer`/`summarizer` はインライン timeout 指定済みで可。失敗時 `.part` 残置も低リスクで残存。

---

## 良い点（参考）

- API キーが renderer に出ない設計、Pixabay/proxy のキーがサーバ側、`detect_from_key` の OpenRouter 明示拒否は堅実。
- DL の `.part`→`rename` アトミック化、per-module クライアントプール分離（失敗モードの結合回避）は意図的で妥当。
- `secretlint` / `commitlint` / `lefthook` 導入済み。
