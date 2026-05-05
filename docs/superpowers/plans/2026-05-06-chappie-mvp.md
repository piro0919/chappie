# Chappie MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tray-only Tauri 2 desktop app (macOS + Windows) where the user says a wake word and has a fully voice-driven conversation with OpenAI. Speech-to-text is local via whisper-rs (Metal-accelerated on macOS). Conversation context is retained for the lifetime of the app process.

**Architecture:** Tauri 2 app with a Rust backend that owns the tray icon, settings store, whisper-rs model context, and on-demand window management. The renderer (React + TypeScript on the WebView) runs the VAD (`@ricky0123/vad-web`), wake-word detection, conversation orchestration, OpenAI calls, and Web Speech `SpeechSynthesis` TTS. Pure logic (state machine, conversation history, OpenAI client wrapper, wake-word detection, settings wrapper, TTS wrapper) lives in plain TypeScript modules under `src/lib/` and is unit-tested with Vitest. The conversation worker is the (hidden) "main" WebView window; the settings UI is a separate WebView window opened on demand from the tray menu.

**Tech Stack:** Tauri 2 (Rust backend), React 19 + TypeScript (Vite), `@ricky0123/vad-web`, `whisper-rs` (Rust, Metal-accelerated), `tauri-plugin-store` (settings persistence), Web Speech `SpeechSynthesis` (TTS), `openai` SDK, Biome + lefthook + commitlint + secretlint (house style). Whisper model: `ggml-base.bin` placed at `~/.chappie/models/ggml-base.bin`, auto-downloaded on first run if missing.

---

## File Structure

```
chappie-desktop/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── biome.json                       # Task 1
├── lefthook.yml                     # Task 1
├── commitlint.config.js             # Task 1
├── .secretlintrc.json               # Task 1
├── index.html
├── public/
│   ├── ort-wasm-*.{mjs,wasm}        # ONNX runtime for VAD (already present)
│   ├── silero_vad_*.onnx            # VAD model (already present)
│   └── vad.worklet.bundle.min.js
├── src/                             # renderer
│   ├── main.tsx                     # routes by ?view=  (Task 3)
│   ├── views/
│   │   ├── ConversationView.tsx     # Task 3 stub → Task 5 wires the loop
│   │   └── SettingsView.tsx         # Task 3 stub → Task 4 form
│   ├── hooks/
│   │   └── useConversationLoop.ts   # Task 5 orchestrator
│   └── lib/
│       ├── state-machine.ts         # already present
│       ├── state-machine.test.ts    # already present
│       ├── conversation-history.ts  # already present
│       ├── conversation-history.test.ts
│       ├── openai-client.ts         # already present
│       ├── openai-client.test.ts
│       ├── speech-synthesis.ts      # already present
│       ├── speech-synthesis.test.ts
│       ├── wake-word.ts             # Task 2
│       ├── wake-word.test.ts        # Task 2
│       ├── settings.ts              # Task 4
│       └── settings.test.ts         # Task 4
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    ├── icons/
    │   ├── tray-idle.png            # Task 3
    │   ├── tray-listening.png       # Task 3
    │   ├── tray-thinking.png        # Task 3
    │   ├── tray-speaking.png        # Task 3
    │   ├── tray-error.png           # Task 3
    │   └── (existing app icons)
    └── src/
        ├── main.rs
        ├── lib.rs                   # transcribe + tray + commands
        ├── tray.rs                  # Task 3
        └── model.rs                 # Task 6 (auto-download)
```

**Boundary notes:**

- `src/lib/` modules are pure TypeScript with no Tauri/DOM-specific dependencies → fully unit-testable. (Exception: `speech-synthesis.ts` uses `window.speechSynthesis` but its tests stub it.)
- `src/hooks/useConversationLoop.ts` is the only place that wires VAD, Tauri commands, OpenAI, and TTS together. Manually verified end-to-end.
- `src-tauri/src/` owns all OS-facing concerns: tray, windows, model download, whisper inference. No business logic.
- The wake word is a compile-time constant in `src/lib/wake-word.ts`. The OpenAI model and system prompt are constants in `src/hooks/useConversationLoop.ts`.

---

## Already done (PoC)

The following are committed on `feat/tauri-pivot` and **must not be redone**. They are the foundation for the remaining tasks.

- ✅ Tauri 2 + React/TS scaffold (commit `a76d102`)
- ✅ VAD (`@ricky0123/vad-web`) integrated in renderer; PCM streamed to Rust (commit `e2eeba4`)
- ✅ `whisper-rs` integrated in Rust with `transcribe(audio, language)` Tauri command, model loaded lazily from `~/.chappie/models/ggml-tiny.bin` (PoC tiny; promoted to base in Task 6)
- ✅ Pure-TS libs from the previous Electron iteration are reused as-is: `state-machine.ts`, `conversation-history.ts`, `openai-client.ts`, `speech-synthesis.ts` (with their `*.test.ts` files)
- ✅ Spec updated to reflect Tauri 2 + whisper-rs (commit `db902dc`)

---

## Decisions locked before tasks start

- **Wake words for MVP:** `"chappie"` and `"チャッピー"` (matched after NFKC + lowercase normalization, substring match). Hardcoded in `src/lib/wake-word.ts`. Configurable later.
- **OpenAI default model:** `gpt-4o-mini`. Hardcoded constant in the conversation-loop hook. Configurable later.
- **Whisper model for MVP:** `ggml-base.bin` (`~/.chappie/models/ggml-base.bin`). PoC verified with `tiny`; MVP promotes to `base` for accuracy. Auto-downloaded on first run.
- **History cap:** keep last 20 messages (10 user + 10 assistant). Older messages dropped FIFO. System prompt is always prepended and not counted. (Already implemented in `conversation-history.ts`.)
- **System prompt:** `"You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud."` Hardcoded constant.
- **Settings persistence:** `tauri-plugin-store` with two keys: `openaiApiKey: string`, `voiceURI: string | null` (null = system-default voice).
- **Follow-up timeout:** if the wake word is uttered alone (no body in the same utterance) and no follow-up speech arrives within 6 seconds, return to idle silently.
- **VAD pause during TTS:** pause VAD while the app is `thinking`/`speaking` to prevent the app's own TTS audio from re-triggering VAD. (This deviates from spec §7's "VAD は流れの間ずっと動かしっぱなしで OK" — the spec note is updated implicitly by this plan.)
- **Package manager:** pnpm.

---

## Task 1: House-style tooling (Biome, lefthook, commitlint, secretlint)

**Files:** `biome.json`, `lefthook.yml`, `commitlint.config.js`, `.secretlintrc.json`, `package.json`, `.gitignore`

- [ ] **Step 1: Install tooling**

```bash
pnpm add -D @biomejs/biome lefthook @commitlint/cli @commitlint/config-conventional secretlint @secretlint/secretlint-rule-preset-recommend
```

- [ ] **Step 2: Initialize Biome**

```bash
pnpm biome init
```

Edit `biome.json`:
- `formatter.indentStyle: "space"`
- Keep `linter.rules.recommended: true`
- Exclude generated/binary directories. Set `files.includes` to:
  - include `src/**`, `*.{ts,tsx,js,json,jsonc}` at repo root
  - explicitly exclude `node_modules/**`, `dist/**`, `src-tauri/target/**`, `src-tauri/gen/**`, `public/*.wasm`, `public/*.mjs`, `public/*.onnx`

- [ ] **Step 3: Create `commitlint.config.js`**

```js
module.exports = { extends: ["@commitlint/config-conventional"] };
```

- [ ] **Step 4: Create `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,json}"
      run: pnpm biome check --write {staged_files}
      stage_fixed: true
    secretlint:
      glob: "*"
      run: pnpm secretlint {staged_files}
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

- [ ] **Step 5: Create `.secretlintrc.json`**

```json
{ "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }] }
```

- [ ] **Step 6: Install hooks**

```bash
pnpm lefthook install
```

- [ ] **Step 7: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "lint": "biome check",
  "format": "biome format --write",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 8: Update `.gitignore`**

Append:
```
# Tauri generated
src-tauri/gen/
src-tauri/target/

# Whisper model cache (downloaded at runtime per-user, not in repo anyway)
.chappie/
```

- [ ] **Step 9: Format the existing TS sources once**

```bash
pnpm biome check --write src
```
Inspect the diff with `git diff` before staging.

- [ ] **Step 10: Smoke-test the hooks**

- Make a trivial whitespace edit in `src/App.tsx`, then `git commit -am "test"` → commitlint should reject the message; retry with a conventional message → biome should auto-format and re-stage.
- Restore intent.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: add biome, lefthook, commitlint, secretlint"
```

---

## Task 2: Wake-word detection + body extraction (pure TS, TDD)

**Files:**
- Create: `src/lib/wake-word.ts`, `src/lib/wake-word.test.ts`

Pure function `detectWake(text)` returns either `{ matched: false }` or `{ matched: true; body: string }`. When `body === ""` the conversation loop interprets it as "wake-only — wait for follow-up utterance".

- [ ] **Step 1: Write failing tests**

`src/lib/wake-word.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectWake } from "./wake-word";

describe("detectWake", () => {
  it("returns matched=false when no wake word", () => {
    expect(detectWake("今日の天気は？")).toEqual({ matched: false });
  });

  it("matches English 'chappie' and returns body after it", () => {
    expect(detectWake("Chappie, what time is it?")).toEqual({
      matched: true,
      body: "what time is it?",
    });
  });

  it("matches Japanese 'チャッピー' and returns body after it", () => {
    expect(detectWake("チャッピー、今何時？")).toEqual({
      matched: true,
      body: "今何時？",
    });
  });

  it("matches case-insensitively", () => {
    expect(detectWake("CHAPPIE tell me a joke")).toEqual({
      matched: true,
      body: "tell me a joke",
    });
  });

  it("matches fullwidth via NFKC normalization", () => {
    expect(detectWake("ｃｈａｐｐｉｅ こんにちは")).toEqual({
      matched: true,
      body: "こんにちは",
    });
  });

  it("returns body='' when only the wake word is uttered", () => {
    expect(detectWake("チャッピー。")).toEqual({ matched: true, body: "" });
    expect(detectWake("Chappie!")).toEqual({ matched: true, body: "" });
  });

  it("trims punctuation/whitespace from body", () => {
    expect(detectWake("チャッピー  、  明日の予定教えて  ")).toEqual({
      matched: true,
      body: "明日の予定教えて",
    });
  });

  it("uses the earliest match when multiple wake words appear", () => {
    expect(detectWake("Chappie チャッピー hi")).toEqual({
      matched: true,
      body: "チャッピー hi",
    });
  });

  it("returns matched=false on empty/whitespace input", () => {
    expect(detectWake("")).toEqual({ matched: false });
    expect(detectWake("   ")).toEqual({ matched: false });
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test:run src/lib/wake-word.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/wake-word.ts`:
```ts
export type WakeMatch =
  | { matched: false }
  | { matched: true; body: string };

const WAKE_WORDS = ["chappie", "チャッピー"] as const;

const TRIM_RE =
  /^[\s、。．，,.!！?？:：;；\-—–…]+|[\s、。．，,.!！?？:：;；\-—–…]+$/g;

function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

export function detectWake(input: string): WakeMatch {
  if (!input.trim()) return { matched: false };
  const normalized = normalize(input);

  let bestIdx = -1;
  let bestLen = 0;
  for (const w of WAKE_WORDS) {
    const idx = normalized.indexOf(normalize(w));
    if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = w.length;
    }
  }
  if (bestIdx === -1) return { matched: false };

  const body = normalized.slice(bestIdx + bestLen).replace(TRIM_RE, "");
  return { matched: true, body };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/wake-word.ts src/lib/wake-word.test.ts
git commit -m "feat: add wake-word detection and body extraction"
```

---

## Task 3: Tauri 2 tray + window management

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/tray.rs`, `src-tauri/icons/tray-{idle,listening,thinking,speaking,error}.png`
- Modify: `src/main.tsx`, `src/App.tsx` (split into views)
- Create: `src/views/ConversationView.tsx`, `src/views/SettingsView.tsx` (placeholders)

- [ ] **Step 1: Generate the 5 tray icons**

22x22 PNGs, solid-color circles on transparent background:
- `idle` `#8a8a8a`
- `listening` `#3b82f6`
- `thinking` `#f59e0b`
- `speaking` `#10b981`
- `error` `#ef4444`

ImageMagick one-liner (run from repo root):
```bash
mkdir -p src-tauri/icons
for s in idle:8a8a8a listening:3b82f6 thinking:f59e0b speaking:10b981 error:ef4444; do
  name=${s%%:*}; col=${s##*:}
  magick -size 22x22 xc:none -fill "#${col}" -draw "circle 11,11 11,3" "src-tauri/icons/tray-${name}.png"
done
ls src-tauri/icons/tray-*.png   # expect 5
```

- [ ] **Step 2: Cargo features**

In `src-tauri/Cargo.toml`, ensure `tauri` features include tray + image-png:
```toml
tauri = { version = "2", features = ["tray-icon", "image-png"] }
```
Run `cd src-tauri && cargo check` to confirm.

- [ ] **Step 3: Create `src-tauri/src/tray.rs`**

```rust
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayState {
    Idle,
    Listening,
    Thinking,
    Speaking,
    Error,
}

impl TrayState {
    fn icon_bytes(self) -> &'static [u8] {
        match self {
            Self::Idle => include_bytes!("../icons/tray-idle.png"),
            Self::Listening => include_bytes!("../icons/tray-listening.png"),
            Self::Thinking => include_bytes!("../icons/tray-thinking.png"),
            Self::Speaking => include_bytes!("../icons/tray-speaking.png"),
            Self::Error => include_bytes!("../icons/tray-error.png"),
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Idle => "Chappie: 待機中",
            Self::Listening => "Chappie: 聞いています",
            Self::Thinking => "Chappie: 考え中",
            Self::Speaking => "Chappie: 喋っています",
            Self::Error => "Chappie: エラー",
        }
    }
}

pub struct TrayHandle(pub Mutex<TrayIcon>);

pub fn init_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, TrayState::Idle)?;
    let icon = Image::from_bytes(TrayState::Idle.icon_bytes())?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip(TrayState::Idle.label())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_settings" => {
                let _ = open_settings_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    app.manage(TrayHandle(Mutex::new(tray)));
    Ok(())
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    state: TrayState,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let status = MenuItemBuilder::with_id("status", state.label())
        .enabled(false)
        .build(app)?;
    let settings = MenuItemBuilder::with_id("open_settings", "設定を開く").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "終了").build(app)?;
    MenuBuilder::new(app)
        .item(&status)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&settings)
        .item(&quit)
        .build()
}

pub fn apply_tray_state<R: Runtime>(
    app: &AppHandle<R>,
    state: TrayState,
) -> tauri::Result<()> {
    let handle = app.state::<TrayHandle>();
    let tray = handle.0.lock().unwrap();
    tray.set_icon(Some(Image::from_bytes(state.icon_bytes())?))?;
    tray.set_tooltip(Some(state.label()))?;
    let menu = build_menu(app, state)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

pub fn open_settings_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?view=settings".into()),
    )
    .title("Chappie 設定")
    .inner_size(480.0, 360.0)
    .resizable(false)
    .build()?;
    Ok(())
}
```

- [ ] **Step 4: Wire tray into `src-tauri/src/lib.rs`**

Add `mod tray;` near the top, add commands `set_tray_state` and `open_settings`, and call `init_tray` from `setup`. Also set macOS activation policy to Accessory:

```rust
mod tray;

use tray::{apply_tray_state, init_tray, open_settings_window, TrayState};

#[tauri::command]
fn set_tray_state(app: tauri::AppHandle, state: TrayState) -> Result<(), String> {
    apply_tray_state(&app, state).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    open_settings_window(&app).map_err(|e| e.to_string())
}
```

In `run()`'s `.setup` closure:
```rust
#[cfg(target_os = "macos")]
let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
init_tray(&app.handle())?;
```

Update `invoke_handler` to:
```rust
.invoke_handler(tauri::generate_handler![transcribe, set_tray_state, open_settings])
```

- [ ] **Step 5: `tauri.conf.json` — hide main window**

In the `app.windows[0]` (`main`) entry: `"visible": false`, `"skipTaskbar": true`. Keep size small (320x200).

- [ ] **Step 6: capability additions**

`src-tauri/capabilities/default.json` permissions add:
```json
"core:tray:default",
"core:menu:default",
"core:webview:allow-create-webview-window",
"core:window:allow-set-focus"
```
(Adjust to whatever the exact Tauri 2 permission identifier names are at the time of implementation; `tauri permission` CLI helps.)

- [ ] **Step 7: Renderer view split**

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConversationView } from "./views/ConversationView";
import { SettingsView } from "./views/SettingsView";

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "settings" ? SettingsView : ConversationView;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
```

`src/views/ConversationView.tsx` — move the current PoC body of `App.tsx` here verbatim (rename the component to `ConversationView`). `App.tsx` becomes obsolete and is deleted.

`src/views/SettingsView.tsx` (placeholder for now):
```tsx
export function SettingsView() {
  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18 }}>Chappie 設定（プレースホルダー）</h1>
      <p>Task 4 で実装。</p>
    </main>
  );
}
```

- [ ] **Step 8: Manual smoke test**

```bash
pnpm tauri dev
```
Expected:
- macOS: dock has no Chappie icon; menu bar shows a gray circle.
- Right-click tray → menu shows `Chappie: 待機中` (disabled), `設定を開く`, `終了`.
- `設定を開く` opens a 480x360 window with the placeholder text. Clicking it again focuses the same window.
- `終了` quits the app.
- DevTools console of the main window: `await window.__TAURI__.core.invoke("set_tray_state", { state: "thinking" })` flips icon to amber and updates the tooltip + status menu item.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add tauri tray with state-based icon and on-demand settings window"
```

---

## Task 4: Settings persistence (`tauri-plugin-store`) + Settings UI

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Modify: `package.json`
- Create: `src/lib/settings.ts`, `src/lib/settings.test.ts`
- Replace: `src/views/SettingsView.tsx` (placeholder → real form)

- [ ] **Step 1: Install plugin (Rust + JS)**

```bash
cd src-tauri && cargo add tauri-plugin-store && cd -
pnpm add @tauri-apps/plugin-store
```

In `src-tauri/src/lib.rs` `Builder` chain:
```rust
.plugin(tauri_plugin_store::Builder::default().build())
```

In `src-tauri/capabilities/default.json` permissions add:
```json
"store:default"
```

- [ ] **Step 2: Tests**

`src/lib/settings.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeStoreState = new Map<string, unknown>();
const fakeStore = {
  get: vi.fn(async (k: string) => fakeStoreState.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    fakeStoreState.set(k, v);
  }),
  save: vi.fn(async () => {}),
};

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => fakeStore),
}));

import { loadSettings, saveSettings, __resetForTests } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    fakeStoreState.clear();
    vi.clearAllMocks();
    __resetForTests();
  });

  it("returns defaults when store is empty", async () => {
    expect(await loadSettings()).toEqual({ openaiApiKey: "", voiceURI: null });
  });

  it("returns persisted values when present", async () => {
    fakeStoreState.set("openaiApiKey", "sk-test");
    fakeStoreState.set("voiceURI", "com.apple.voice.Kyoko");
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-test",
      voiceURI: "com.apple.voice.Kyoko",
    });
  });

  it("merges patch on save and persists", async () => {
    await saveSettings({ openaiApiKey: "sk-new" });
    expect(fakeStore.set).toHaveBeenCalledWith("openaiApiKey", "sk-new");
    expect(fakeStore.save).toHaveBeenCalled();
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-new",
      voiceURI: null,
    });
  });

  it("allows clearing voiceURI to null", async () => {
    fakeStoreState.set("voiceURI", "abc");
    await saveSettings({ voiceURI: null });
    expect(fakeStore.set).toHaveBeenCalledWith("voiceURI", null);
    expect((await loadSettings()).voiceURI).toBeNull();
  });

  it("ignores undefined fields in patch", async () => {
    await saveSettings({ openaiApiKey: undefined, voiceURI: "v1" });
    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "openaiApiKey",
      expect.anything(),
    );
    expect(fakeStore.set).toHaveBeenCalledWith("voiceURI", "v1");
  });
});
```

- [ ] **Step 3: Implement**

`src/lib/settings.ts`:
```ts
import { load, type Store } from "@tauri-apps/plugin-store";

export type Settings = {
  openaiApiKey: string;
  voiceURI: string | null;
};

const DEFAULTS: Settings = { openaiApiKey: "", voiceURI: null };
const FILE = "settings.json";

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = load(FILE, { autoSave: false });
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const apiKey =
    (await store.get<string>("openaiApiKey")) ?? DEFAULTS.openaiApiKey;
  const voiceURI =
    (await store.get<string | null>("voiceURI")) ?? DEFAULTS.voiceURI;
  return { openaiApiKey: apiKey, voiceURI };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const store = await getStore();
  if (patch.openaiApiKey !== undefined) {
    await store.set("openaiApiKey", patch.openaiApiKey);
  }
  if (patch.voiceURI !== undefined) {
    await store.set("voiceURI", patch.voiceURI);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm test:run src/lib/settings.test.ts
```

- [ ] **Step 5: Replace `src/views/SettingsView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { loadSettings, saveSettings, type Settings } from "../lib/settings";

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const s: Settings = await loadSettings();
      setApiKey(s.openaiApiKey);
      setVoiceURI(s.voiceURI);
      setLoaded(true);
    })();
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const onSave = async () => {
    await saveSettings({ openaiApiKey: apiKey, voiceURI });
    await emit("settings:updated");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!loaded) {
    return <main style={{ padding: 16 }}>読み込み中…</main>;
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Chappie 設定</h1>

      <label style={{ display: "block", marginTop: 16 }}>
        OpenAI API キー
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        読み上げ音声
        <select
          value={voiceURI ?? ""}
          onChange={(e) =>
            setVoiceURI(e.target.value === "" ? null : e.target.value)
          }
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        >
          <option value="">（システム既定）</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>

      <div style={{ marginTop: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={onSave}>
          保存
        </button>
        {saved && <span style={{ color: "#10b981" }}>保存しました</span>}
      </div>
    </main>
  );
}
```

(`emit` import requires `core:event:default` capability — added in Task 5.)

- [ ] **Step 6: Manual smoke test**

```bash
pnpm tauri dev
```
- Tray → 設定を開く → form renders.
- Enter a fake API key, pick a voice, 保存 → "保存しました".
- Close + reopen → values persist.
- Quit + restart → values still persist.
- Verify file: `cat "$HOME/Library/Application Support/io.kkweb.chappie/settings.json"` (path varies by `tauri.conf.json` `identifier`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: persist settings via tauri-plugin-store and wire settings UI"
```

---

## Task 5: Conversation loop integration

**Files:**
- Create: `src/hooks/useConversationLoop.ts`
- Replace: `src/views/ConversationView.tsx`
- Modify: `src-tauri/capabilities/default.json` (add `core:event:default`)

This is where every previous piece is wired together: VAD → `transcribe` → `detectWake` → state machine → OpenAI → `speak` → tray sync.

- [ ] **Step 1: Add event capability**

In `src-tauri/capabilities/default.json` permissions, add:
```json
"core:event:default"
```

- [ ] **Step 2: Create `src/hooks/useConversationLoop.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import OpenAI from "openai";
import {
  createMachine,
  transition,
  type Machine,
  type Event as MachineEvent,
  type State,
} from "../lib/state-machine";
import {
  createHistory,
  addUser,
  addAssistant,
  messagesForRequest,
  type History,
} from "../lib/conversation-history";
import { createChatClient } from "../lib/openai-client";
import { detectWake } from "../lib/wake-word";
import { speak } from "../lib/speech-synthesis";
import { loadSettings } from "../lib/settings";

const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud.";
const FOLLOWUP_TIMEOUT_MS = 6000;
const WHISPER_LANG = "ja";

export function useConversationLoop() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const machineRef = useRef<Machine>(createMachine());
  const historyRef = useRef<History>(createHistory(SYSTEM_PROMPT));
  const apiKeyRef = useRef<string>("");
  const voiceURIRef = useRef<string | null>(null);
  const vadRef = useRef<MicVAD | null>(null);
  const awaitingBodyRef = useRef(false);
  const followupTimerRef = useRef<number | null>(null);

  function dispatch(event: MachineEvent) {
    const next = transition(machineRef.current, event);
    if (next === machineRef.current) return;
    machineRef.current = next;
    setState(next.state);
    void invoke("set_tray_state", { state: next.state }).catch(() => {});
  }

  function clearFollowupTimer() {
    if (followupTimerRef.current !== null) {
      clearTimeout(followupTimerRef.current);
      followupTimerRef.current = null;
    }
  }

  async function transcribe(audio: Float32Array): Promise<string> {
    return invoke<string>("transcribe", {
      audio: Array.from(audio),
      language: WHISPER_LANG,
    });
  }

  async function handleUtterance(audio: Float32Array) {
    const cur = machineRef.current.state;
    if (cur === "thinking" || cur === "speaking" || cur === "error") return;

    let text = "";
    try {
      text = await transcribe(audio);
    } catch (e) {
      console.error("transcribe failed", e);
      return;
    }

    if (awaitingBodyRef.current) {
      awaitingBodyRef.current = false;
      clearFollowupTimer();
      const body = text.trim();
      if (!body) {
        dispatch({ type: "speechTimeout" });
        return;
      }
      dispatch({ type: "speechCaptured", text: body });
      await runTurn(body);
      return;
    }

    const m = detectWake(text);
    if (!m.matched) return;

    if (m.body === "") {
      dispatch({ type: "wakeDetected" });
      awaitingBodyRef.current = true;
      followupTimerRef.current = window.setTimeout(() => {
        awaitingBodyRef.current = false;
        followupTimerRef.current = null;
        dispatch({ type: "speechTimeout" });
      }, FOLLOWUP_TIMEOUT_MS);
      return;
    }

    dispatch({ type: "wakeDetected" });
    dispatch({ type: "speechCaptured", text: m.body });
    await runTurn(m.body);
  }

  async function runTurn(userText: string) {
    vadRef.current?.pause();
    try {
      if (!apiKeyRef.current) {
        try {
          await speak(
            "OpenAI APIキーが未設定です。設定画面から登録してください。",
            voiceURIRef.current,
          );
        } catch {}
        dispatch({ type: "responseFailed", message: "no api key" });
        dispatch({ type: "errorAcknowledged" });
        return;
      }

      historyRef.current = addUser(historyRef.current, userText);

      let reply: string;
      try {
        const openai = new OpenAI({
          apiKey: apiKeyRef.current,
          dangerouslyAllowBrowser: true,
        });
        const client = createChatClient(openai, MODEL);
        reply = await client.complete(messagesForRequest(historyRef.current));
      } catch (e) {
        console.error("openai failed", e);
        try {
          await speak("うまく繋がりませんでした。", voiceURIRef.current);
        } catch {}
        dispatch({ type: "responseFailed", message: String(e) });
        dispatch({ type: "errorAcknowledged" });
        return;
      }

      historyRef.current = addAssistant(historyRef.current, reply);
      dispatch({ type: "responseReady", reply });

      try {
        await speak(reply, voiceURIRef.current);
      } catch (e) {
        console.error("tts failed", e);
      }
      dispatch({ type: "speechDone" });
    } finally {
      try {
        vadRef.current?.start();
      } catch {}
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;

        const vad = await MicVAD.new({
          baseAssetPath: "/",
          onnxWASMBasePath: "/",
          onSpeechEnd: (audio) => {
            void handleUtterance(audio);
          },
        });
        if (cancelled) {
          vad.destroy();
          return;
        }
        vadRef.current = vad;
        vad.start();
        void invoke("set_tray_state", { state: "idle" }).catch(() => {});
      } catch (e) {
        console.error("conversation loop init failed", e);
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      clearFollowupTimer();
      vadRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen("settings:updated", async () => {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return { state, error };
}
```

- [ ] **Step 3: Replace `src/views/ConversationView.tsx`**

```tsx
import { useConversationLoop } from "../hooks/useConversationLoop";

export function ConversationView() {
  const { state, error } = useConversationLoop();
  return (
    <main style={{ padding: 8, fontFamily: "system-ui, sans-serif" }}>
      <div>Chappie worker</div>
      <div>状態: {state}</div>
      {error && (
        <div style={{ color: "red", whiteSpace: "pre-wrap", marginTop: 4 }}>
          {error}
        </div>
      )}
    </main>
  );
}
```

(The window stays hidden; this UI is for DevTools-side inspection only.)

- [ ] **Step 4: Manual end-to-end verification (sequence)**

`pnpm tauri dev` and run through:

1. **Startup** — tray idle, main window hidden, DevTools console shows VAD init logs.
2. **Non-wake utterance is discarded** — say "今日の天気は？" only. Tray stays idle. No TTS.
3. **Wake + body in one breath** — say "チャッピー、今何時？". Tray transitions `idle → listening → thinking → speaking → idle` with the right colors. OpenAI's reply is read aloud.
4. **Wake-only + follow-up** — say "チャッピー" alone. Tray turns blue (listening). Within 6s say "明日の天気は？" → continues to thinking → speaking → idle.
5. **Follow-up timeout** — say "チャッピー" alone, stay silent 7+s. Tray returns to gray silently, no TTS.
6. **Multi-turn context** — "チャッピー、私の名前は河村です" → reply → "チャッピー、私の名前覚えてる？" → reply references 河村.
7. **No-API-key path** — clear API key in Settings, save. Conversation worker DevTools shows `settings:updated` reflected. Say "チャッピー、おはよう" → TTS says "OpenAI APIキーが未設定です…", returns to idle.
8. **TTS self-trigger guard** — during reply playback, no spurious VAD trigger / re-transcription.
9. **Restart resets history** — quit, restart, ask the name → no recall.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate VAD, whisper, wake-word, openai, tts, tray state into loop"
```

---

## Task 6: Promote Whisper to base + auto-download UX

**Files:**
- Modify: `src-tauri/Cargo.toml` (add `reqwest`, `tokio`, `dirs`)
- Create: `src-tauri/src/model.rs`
- Modify: `src-tauri/src/lib.rs` (`model_path` → base, add `ensure_model` command, emit progress events)
- Modify: `src/hooks/useConversationLoop.ts` (await `ensure_model` before starting VAD; handle progress UI)
- Modify: `src-tauri/capabilities/default.json` (`core:event:default` already added)

**Constraints:**
- Source URL: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin` (~150MB)
- Destination: `~/.chappie/models/ggml-base.bin`
- If file already exists with non-zero size, skip download.
- Progress: emit `model:progress` with `{ received, total }` periodically; `model:ready` on success; `model:error` with `{ message }` on failure.
- Tray icon during download: `thinking` color with tooltip "Whisper モデルを取得中…"; switch to `idle` once ready.

- [ ] **Step 1: Add Rust deps**

```bash
cd src-tauri
cargo add reqwest --features rustls-tls,stream --no-default-features
cargo add tokio --features rt-multi-thread,macros,fs,io-util
cargo add dirs
cargo add futures-util
cd -
```

- [ ] **Step 2: Create `src-tauri/src/model.rs`**

```rust
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

pub fn model_path() -> PathBuf {
    let home = dirs::home_dir().expect("home dir unset");
    home.join(".chappie/models/ggml-base.bin")
}

pub async fn ensure_model<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    let path = model_path();
    if path.exists() {
        if let Ok(meta) = tokio::fs::metadata(&path).await {
            if meta.len() > 0 {
                return Ok(path);
            }
        }
    }
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("mkdir: {e}"))?;
    }

    let res = reqwest::get(MODEL_URL)
        .await
        .map_err(|e| format!("request: {e}"))?;
    let total = res.content_length().unwrap_or(0);
    let mut received: u64 = 0;
    let mut stream = res.bytes_stream();

    let tmp = path.with_extension("bin.part");
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("create tmp: {e}"))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write: {e}"))?;
        received += chunk.len() as u64;
        let _ = app.emit(
            "model:progress",
            serde_json::json!({ "received": received, "total": total }),
        );
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    drop(file);
    tokio::fs::rename(&tmp, &path)
        .await
        .map_err(|e| format!("rename: {e}"))?;
    let _ = app.emit("model:ready", serde_json::json!({ "path": path.to_string_lossy() }));
    Ok(path)
}
```

- [ ] **Step 3: Modify `src-tauri/src/lib.rs`**

- Replace the local `model_path()` function with `model::model_path()`.
- Update `get_ctx()` to use the base path.
- Add a Tauri command:
  ```rust
  #[tauri::command]
  async fn ensure_model(app: tauri::AppHandle) -> Result<String, String> {
      model::ensure_model(app).await.map(|p| p.to_string_lossy().into_owned())
  }
  ```
- Register `ensure_model` in `invoke_handler`.
- Add `mod model;`.

Note: `transcribe` must continue to fail clearly if called before the model is downloaded — `get_ctx()` will already return an error, which is fine.

- [ ] **Step 4: Renderer — gate VAD on `ensure_model`**

In `useConversationLoop.ts`, before calling `MicVAD.new`:

```ts
// inside the init effect
void invoke("set_tray_state", { state: "thinking" }).catch(() => {});
const off = await listen<{ received: number; total: number }>(
  "model:progress",
  (e) => {
    setError(null);
    const pct = e.payload.total
      ? Math.floor((e.payload.received / e.payload.total) * 100)
      : 0;
    setError(`Whisper モデルを取得中… ${pct}%`); // reuse the error slot for status
  },
);
try {
  await invoke<string>("ensure_model");
} finally {
  off();
}
setError(null);
void invoke("set_tray_state", { state: "idle" }).catch(() => {});
```

(For MVP, reusing `error` as a generic status banner is acceptable; the conversation window is hidden anyway. The tray tooltip "考え中" doubles as user-visible feedback.)

- [ ] **Step 5: Manual verification**

- Delete the model: `rm -f ~/.chappie/models/ggml-base.bin ~/.chappie/models/ggml-tiny.bin`
- `pnpm tauri dev`. Tray turns amber on launch and tooltip says `Chappie: 考え中` while download runs. Once complete, tray flips to idle. File present at `~/.chappie/models/ggml-base.bin`.
- Re-launch with the file present → tray goes straight to idle (no download).
- Run a wake-word turn — verify base accuracy is noticeably better than the PoC tiny on a Japanese sentence.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: promote whisper to base with first-run auto-download"
```

---

## Task 7: macOS / Windows packaging

**Files:**
- Modify: `src-tauri/tauri.conf.json` (`bundle` section, identifier confirmed)

- [ ] **Step 1: Confirm identifier and product name**

In `src-tauri/tauri.conf.json`:
```json
"identifier": "io.kkweb.chappie",
"productName": "Chappie",
"version": "0.1.0"
```

Bundle config:
```json
"bundle": {
  "active": true,
  "targets": ["dmg", "app", "nsis"],
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "resources": ["icons/tray-*.png"],
  "category": "Productivity"
}
```

(Tray PNGs are `include_bytes!`-ed by `tray.rs` so `resources` is just defense-in-depth; not strictly needed.)

- [ ] **Step 2: macOS build**

```bash
pnpm tauri build
```
Expect: `src-tauri/target/release/bundle/dmg/Chappie_0.1.0_*.dmg` and `bundle/macos/Chappie.app`.

- [ ] **Step 3: macOS smoke test**

Drag `Chappie.app` to `/Applications`, launch from Spotlight. macOS will prompt for microphone permission on first VAD use; allow. Open the tray menu, paste an OpenAI API key, run one wake-word turn end-to-end. Note: on Apple Silicon, signing/notarization is **deferred** — Gatekeeper will require right-click → 開く on first launch.

- [ ] **Step 4: Windows build (deferred to a Windows host)**

```bash
pnpm tauri build
```
Expect: `bundle/nsis/Chappie_0.1.0_*-setup.exe`. Run installer, launch, smoke test. CPU-only Whisper inference will be slower than macOS Metal — flag if response feels >10s on a typical mid-range Windows laptop.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure tauri bundling for mac/win packaging"
```

---

## Task 8: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite README**

```md
# Chappie Desktop

ハンズフリー音声AIアシスタント。ウェイクワード「chappie」「チャッピー」で起動して声だけで会話できる、トレイ常駐のデスクトップアプリ。

## アーキテクチャ

- Tauri 2（Rust 製バックエンド + WebView UI）
- 音声区切り検出: `@ricky0123/vad-web`
- STT: `whisper-rs`（Rust 側、macOS は Metal 加速）
- ウェイクワード判定: 文字列マッチ（renderer 側）
- AI: OpenAI Chat Completions（`gpt-4o-mini`）
- TTS: Web Speech API `SpeechSynthesis`
- 設定永続化: `tauri-plugin-store`

## 開発

```bash
pnpm install
pnpm tauri dev
```

初回起動時に `~/.chappie/models/ggml-base.bin`（約150MB）を自動ダウンロード。トレイの「設定を開く」から OpenAI API キーを登録すると会話が始められる。

## ビルド

```bash
pnpm tauri build
```

成果物は `src-tauri/target/release/bundle/` 以下に生成される（macOS: `dmg`、Windows: `nsis`）。

## ライセンス
MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for Tauri 2 + whisper-rs MVP"
```

---

## Self-review notes

- **Spec → task mapping**: §1〜§4 (コンセプト/ターゲット/差別化軸/MVPスコープ) は README (Task 8) と全タスクの背景。§5 技術スタックは Tasks 1, 3, 4, 5, 6 で実装。§6 プラットフォームは Task 7。§7 動作フローは Task 5 の `useConversationLoop` がそのまま実装。§8 UI 構成は Tasks 3 (トレイ・ウィンドウ) + 4 (設定 UI)。§9 エラー時の振る舞いは Task 5 内で `responseFailed`/タイムアウト/no-API-key 経路として実装。§10 既知のトレードオフは plan の "Decisions locked" と Task 5 判断ポイントに反映。§11 拡張余地は実装対象外（spec のメモのまま）。
- **PoC で完了済みの作業を尊重**: `state-machine.ts` / `conversation-history.ts` / `openai-client.ts` / `speech-synthesis.ts` は再実装せず流用。`transcribe` Tauri command も再実装せず Task 6 で base 対応のために `model_path` だけ差し替える。
- **Decisions locked の値はタスク間で一貫**: ウェイクワード `"chappie"` / `"チャッピー"` (Task 2)、`gpt-4o-mini` / system prompt / `FOLLOWUP_TIMEOUT_MS=6000` (Task 5)、`ggml-base.bin` (Task 6)、設定 2 キー (Task 4)。
- **型契約のクロスファイル整合**: `TrayState` (Rust enum, lowercase serde) ↔ `State` (TS state-machine union) が一致。`Settings` (TS) ↔ store keys (`openaiApiKey`, `voiceURI`)。`MachineEvent` 型は `useConversationLoop` の dispatch で網羅。
- **Spec §7 との差分**: 「VAD は流れの間ずっと動かしっぱなしで OK」と書いてあるが、TTS セルフトリガー回避のため Task 5 で `thinking`/`speaking` 中は VAD を pause する。Decisions locked に明記済み。spec の文言は次回更新時に追補する。
- **モデル DL の失敗ハンドリング**: ネットワーク不通時、`ensure_model` のエラーは `useConversationLoop` の `setError` に流れ、tray は `idle` のまま (`thinking` から戻らない可能性あり)。MVP 後で `model:error` 受信時に `error` 色 + 再試行ボタンの UX を追加する余地。
