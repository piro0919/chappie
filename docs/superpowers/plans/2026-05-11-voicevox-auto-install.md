# VOICEVOX engine 自動 DL + subprocess 化（次フェーズ）

## Context

前段で実装済み：
- VOICEVOX engine subprocess 管理（`src-tauri/src/voicevox.rs`）
- `/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run` を検出して `--port 50121` で spawn
- ENGINE_URL を 50121 に切替（無ければ 50021 へフォールバック）
- 起動時 readiness probe（30s）+ orphan engine adopt + `kill_on_drop`

→ **GUI 版を入れているユーザーは何もせずにキャラ wake が使える状態**

このフェーズで対応する：

→ **GUI 版を入れていないユーザーが Settings から「インストール」ボタン 1 発で engine を自動 DL → 配置 → spawn できる**ようにする

## 範囲

### やる

1. Settings に VOICEVOX 状態表示（「Chappie 管理 / GUI 流用 / 未インストール」）+ インストール / アンインストールボタン
2. Rust 側に以下の Tauri command 追加
   - `voicevox_install_status()` → `{ kind: "managed" | "bundled_app" | "missing", path?: string }`
   - `voicevox_install()` → ストリーム DL + 7z 展開 + 実行権限 + xattr → spawn まで
   - `voicevox_uninstall()` → spawned engine kill + ディレクトリ削除
   - 進捗イベント `voicevox:install_progress` `{ phase: "download"|"extract"|"verify", received, total }`
3. 検出ロジック更新：`~/.chappie/voicevox/run` を最優先、次に `/Applications/VOICEVOX.app/...`
4. クレジット表記を Settings / About に追加（VOICEVOX engine + 各キャラ voicelib）

### やらない

- Windows / Linux 対応（別 plan、Mac 安定後）
- VVPP フォーマット対応（GUI 専用フォーマット、CLI 流用には .7z.001 で十分）
- engine 自動更新（手動「再インストール」で済ませる、半年〜1年に 1 回）
- 部分 DL レジューム（リトライ時は最初から、シンプルさ優先）
- DL スループット制限 / バックグラウンド DL

## 編集対象ファイル

### 新規

- なし（voicevox.rs に統合）

### 編集

- `src-tauri/src/voicevox.rs` — install / uninstall / status command 追加、検出順位更新
- `src-tauri/Cargo.toml` — おそらく追加クレート不要（reqwest stream + tokio process + std::process::Command tar が既存）
- `src/views/SettingsView.tsx` — VOICEVOX セクションに状態 + インストールボタン + 進捗バー
- `src/i18n/messages.ts` — 9 言語に新 UI 文字列追加
- `src/lib/voicevox-install.ts`（新規）— Tauri command ラッパー + 進捗イベント listen

## 既存パターン流用

- **ストリーム DL + 進捗イベント**: `src-tauri/src/model.rs::download_model` がまさに同じパターン（Whisper モデル DL）。`reqwest::Response::bytes_stream()` + Tauri event emit、進捗 % 計算ロジック流用可
- **HTTP**: voicevox.rs の `HTTP` Lazy client を流用、ただし DL 用に timeout 別建て（30s じゃ足りない、無制限 or 30 分）
- **i18n**: 既存 9 言語 catalog のパターン
- **Settings 状態 fetch**: 起動時 `voicevox_install_status` を invoke、`settings:updated` イベントで再 fetch

## 検出ロジック更新

優先順位（前後あるけどユーザー意図にこれが沿う）：

```rust
fn detect_engine_binary() -> Option<(PathBuf, EngineSource)> {
    // 1. Chappie 管理（最優先：ユーザーがアンインストールしたいなら関与可能な範囲）
    let managed = chappie_data_dir().join("voicevox/run");
    if managed.is_file() {
        return Some((managed, EngineSource::Managed));
    }
    // 2. GUI 同梱を流用
    let bundled = PathBuf::from("/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run");
    if bundled.is_file() {
        return Some((bundled, EngineSource::BundledApp));
    }
    let user_bundled = dirs::home_dir()?.join("Applications/VOICEVOX.app/Contents/Resources/vv-engine/run");
    if user_bundled.is_file() {
        return Some((user_bundled, EngineSource::BundledApp));
    }
    None
}
```

`EngineSource` を返すのは Settings に「どこ経由か」を表示するため。

## 実装ステップ

### Step 1: 検出 API 整備（Rust）

`voicevox.rs` の `detect_bundled_engine` を `detect_engine_binary` にリネーム + 上記の優先順位に。`EngineSource` enum 追加。

`voicevox_install_status` command 追加：

```rust
#[derive(serde::Serialize)]
pub struct InstallStatus {
    kind: &'static str,  // "managed" | "bundled_app" | "missing"
    path: Option<String>,
    engine_url: Option<String>,
}

#[tauri::command]
pub async fn voicevox_install_status() -> InstallStatus { ... }
```

**チェックポイント**: devtools console から `await __TAURI__.core.invoke('voicevox_install_status')` を叩いて状態が取れる。

### Step 2: ダウンロード & 展開（Rust）

```rust
#[tauri::command]
pub async fn voicevox_install(app: tauri::AppHandle) -> Result<(), String> {
    // 1. 既に managed 配置済みならエラー（uninstall してから）
    // 2. ~/.chappie/voicevox/ を一時的に ~/.chappie/voicevox.tmp/ として作成
    // 3. GitHub releases /latest を取って適切な asset URL 解決
    //    (例: voicevox_engine-macos-arm64-X.Y.Z.7z.001)
    // 4. reqwest stream で DL、進捗を `voicevox:install_progress` で emit
    //    (phase=download, received, total)
    // 5. tar -xf で ~/.chappie/voicevox.tmp/ に展開（phase=extract、子プロセス進捗は無いので indeterminate）
    // 6. xattr -dr com.apple.quarantine ~/.chappie/voicevox.tmp/
    // 7. chmod +x ~/.chappie/voicevox.tmp/run（必要なら）
    // 8. アトミック rename ~/.chappie/voicevox.tmp → ~/.chappie/voicevox
    // 9. 既存 spawn を kill して新しい binary で spawn し直す
    // 10. readiness probe (phase=verify)
}
```

**チェックポイント**: GUI 版を一時的に取り除いた状態で `voicevox_install` 叩く → 約 1.7GB DL → 展開 → 起動 → ずんだもん wake → 音声再生まで。

### Step 3: アンインストール（Rust）

```rust
#[tauri::command]
pub async fn voicevox_uninstall() -> Result<(), String> {
    // 1. SPAWNED_CHILD があれば kill して None に
    // 2. ENGINE_URL を default に戻す
    // 3. ~/.chappie/voicevox/ を rm -rf
    // 4. 検出をやり直して、GUI 版があればそれを spawn し直す
}
```

**チェックポイント**: 削除後、ディスクが ~2GB 解放されている。GUI 版があるなら自動で fallback 起動。

### Step 4: Settings UI

`SettingsView.tsx` の VOICEVOX セクションを拡張：

- 状態バッジ：
  - 「Chappie 管理 ✓」（緑）
  - 「VOICEVOX アプリ流用 ✓」（緑）
  - 「未インストール」（グレー）
- 状態に応じてボタン：
  - missing → 「キャラ機能をインストール（約 1.7GB）」
  - managed → 「アンインストール（1.7GB 解放）」
  - bundled_app → 「VOICEVOX アプリを流用中。Chappie 専用にインストールするには（任意・1.7GB）」
- DL 中：進捗バー（received/total MB）+ phase ラベル + キャンセルボタン
- engine 接続状態は前段の `voicevox_speakers_list` poll を継続

クレジット表記を「VOICEVOX 機能について」アコーディオンに追加：

> VOICEVOX (https://voicevox.hiroshiba.jp/) を使用しています。
> 各キャラクターの音声には個別の利用規約があります。動画・配信等で
> 使用する場合は「VOICEVOX:キャラ名」の表記が必要です。

### Step 5: 検出順位の subprocess spawn 連携

前段で実装した `init_managed_engine` を `init_engine` にリネーム：

```rust
pub fn init_engine(handle: &tauri::AppHandle) {
    let Some((binary, source)) = detect_engine_binary() else {
        eprintln!("[voicevox] no engine found; install from Settings");
        return;
    };
    eprintln!("[voicevox] using {source:?} engine: {binary:?}");
    tauri::async_runtime::spawn(async move {
        if let Err(e) = spawn_managed_engine(binary).await {
            eprintln!("[voicevox] spawn failed: {e}");
        }
    });
}
```

### Step 6: i18n

9 言語に追加：
- `settings.voicevoxStatusManaged` "Chappie 管理"
- `settings.voicevoxStatusBundledApp` "VOICEVOX アプリ流用"
- `settings.voicevoxStatusMissing` "未インストール"
- `settings.voicevoxInstall` "インストール"
- `settings.voicevoxUninstall` "アンインストール"
- `settings.voicevoxInstallProgress` "ダウンロード中… {received}MB / {total}MB"
- `settings.voicevoxExtracting` "展開中…"
- `settings.voicevoxVerifying` "起動確認中…"
- `settings.voicevoxCredits` クレジット文

## Verification

### 機能動作確認

1. **GUI 版アリ + 管理版ナシ** （現状） → status: bundled_app、Settings に「Chappie 専用にインストール（任意）」表示
2. **両方アリ** → status: managed（管理版優先）、Settings に「アンインストール」表示
3. **両方ナシ** （/Applications/VOICEVOX.app を移動して再起動）→ status: missing、Settings に「インストール」ボタン
4. インストール押下 → 進捗バー → 完了 → ずんだもん wake で音声再生
5. アンインストール押下 → 削除確認 → 削除完了 → GUI 版あれば自動 fallback、無ければ missing 状態

### 判定ポイント

- **DL 速度**: 1.7GB が普通の家庭回線で何分かかるか（10Mbps なら ~25分、100Mbps なら ~3分）。25 分以上は UX として厳しい
- **展開速度**: tar -xf で 1.7GB → 2GB が CPU バウンド、~1〜2 分想定
- **キャンセル耐性**: DL 中にキャンセル → 一時ディレクトリだけ残ってアトミック rename されてないこと
- **再インストール**: アンインストール → 再インストールでクリーンに動くか
- **ディスクフル**: DL 前のチェック（1.7GB DL + 2GB 展開 + マージン = 4GB 必要）

## 既知の懸念

- **DL サイズ大きい**: 1.7GB 圧縮 / 2GB 展開。光回線前提でも数分かかる。LP に書く時は明示
- **GitHub Releases ダウンロード制限**: GitHub 側で IP ベースの帯域制限がある可能性。リリース直後に殺到すると遅い。代替ミラー検討（次フェーズ）
- **VOICEVOX engine バージョン更新**: 半年〜1年に 1 回。Chappie 側で latest_release 見て「新しいバージョンあります、再インストール？」を出す対応は別 plan
- **macOS Gatekeeper**: 自前 DL の binary は ad-hoc 署名すらされてない。`xattr -dr com.apple.quarantine` で quarantine 属性を剥がせば実行可能（Chappie 自体が ad-hoc 署名されてるので、子プロセスとして起動なら基本通る）
- **CPU 版のみ対応**: GPU 版は 3GB 超えてサイズ厳しい。当面 CPU 版固定（小さい・大半のユーザーで十分）
- **アーキテクチャ判定**: arm64 / x86_64 を `std::env::consts::ARCH` で分岐して適切な asset URL 選択

## Out of scope（次フェーズ以降）

- Windows / Linux 対応（OS ごとに DL URL とインストール先が違う、別 plan）
- engine 自動更新検出 + 更新フロー
- 部分 DL レジューム / 並列 DL
- VOICEVOX エンジン代替バックエンド（Coqui-tts 等）
- キャラ別 voicelib の追加 DL（公式は engine に全部同梱なので非該当）
- バックグラウンド DL（Chappie 落としても続く）
