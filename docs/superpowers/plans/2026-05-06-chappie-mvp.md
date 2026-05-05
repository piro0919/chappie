# Chappie MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a tray-only Electron desktop app (macOS + Windows) where the user says a wake word and has a fully voice-driven conversation with OpenAI, with conversation context retained for the lifetime of the app process.

**Architecture:** Electron app with a main process (tray icon, windows, settings persistence, IPC) and two renderer processes — a hidden persistent "conversation worker" running the wake-word / STT / OpenAI / TTS loop, and an on-demand settings window. Pure logic (state machine, conversation history, OpenAI client) lives in plain TypeScript modules tested with Vitest. Audio APIs are wrapped behind narrow interfaces so the loop can be reasoned about without real audio.

**Tech Stack:** Electron, electron-vite, React 19 + TypeScript, Vitest + happy-dom, `use-ear` (wake word, Web Speech API), browser-native `SpeechRecognition` (post-wake STT) and `speechSynthesis` (TTS), `electron-store` (settings persistence), `openai` SDK, Biome + lefthook + commitlint (matches house style).

---

## File Structure

```
chappie-desktop/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── biome.json
├── lefthook.yml
├── commitlint.config.js
├── .gitignore
├── .env.example
├── electron/
│   ├── main/
│   │   ├── index.ts                # app lifecycle, window orchestration, IPC handlers
│   │   ├── tray.ts                 # tray icon + menu, state→icon mapping
│   │   └── settings-store.ts       # typed wrapper around electron-store
│   └── preload/
│       └── index.ts                # contextBridge: settings get/set, tray state setter
├── resources/
│   ├── tray-idle.png
│   ├── tray-listening.png
│   ├── tray-thinking.png
│   ├── tray-speaking.png
│   └── tray-error.png
├── src/                            # renderer source (shared by both windows)
│   ├── main.tsx                    # React entry (route by ?view=)
│   ├── App.tsx
│   ├── views/
│   │   ├── ConversationView.tsx    # hidden worker window UI (status text only)
│   │   └── SettingsView.tsx        # settings form
│   ├── lib/
│   │   ├── state-machine.ts        # pure state machine
│   │   ├── state-machine.test.ts
│   │   ├── conversation-history.ts # in-memory history with size cap
│   │   ├── conversation-history.test.ts
│   │   ├── openai-client.ts        # wraps openai.chat.completions
│   │   ├── openai-client.test.ts
│   │   ├── speech-synthesis.ts     # Promise wrapper around speechSynthesis
│   │   └── command-recognition.ts  # Promise wrapper around SpeechRecognition
│   ├── hooks/
│   │   └── useConversationLoop.ts  # orchestrates state machine + I/O
│   └── ipc.ts                      # typed accessor for window.api
└── docs/superpowers/
    ├── specs/2026-05-06-chappie-design.md (existing)
    └── plans/2026-05-06-chappie-mvp.md     (this file)
```

**Boundary notes:**

- `src/lib/` modules are pure TypeScript with no DOM/Electron dependencies → fully unit-testable.
- `src/hooks/useConversationLoop.ts` is the only place that wires audio I/O, OpenAI, and the state machine together. Manually verified.
- `electron/main/` has no React, no audio. Just process orchestration.
- The wake word string is a compile-time constant (per spec §8). Defined in `src/lib/state-machine.ts` (or a small `src/lib/config.ts` if it grows).

---

## Decisions locked before tasks start

- **Wake word for MVP:** `"chappie"` (English pronunciation). Single word, English locale (`en-US`), to avoid Japanese homophone false-positives. Configurable later.
- **OpenAI default model:** `gpt-4o-mini`. Hardcoded constant. Configurable later.
- **History cap:** keep last 20 messages (10 user + 10 assistant). Older messages dropped FIFO. System prompt is always prepended and not counted.
- **System prompt:** `"You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud."` Hardcoded constant.
- **Settings persistence:** `electron-store` with two keys: `openaiApiKey: string`, `voiceURI: string | null` (null = browser default).
- **False-wake timeout:** if no speech is captured within 6 seconds after wake-word fires, return to idle silently.
- **Package manager:** pnpm.

---

## Task 1: Initialize project skeleton

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `.gitignore`, `.env.example`

- [ ] **Step 1: Scaffold with electron-vite**

Run from `/Users/piro/Repository/chappie-desktop`:
```bash
pnpm create @quick-start/electron@latest . --template react-ts
```
When prompted: project name `chappie-desktop`, overwrite if asked.

- [ ] **Step 2: Verify scaffold runs**

```bash
pnpm install
pnpm dev
```
Expected: an Electron window opens showing the React+TS starter. Close it.

- [ ] **Step 3: Add runtime deps**

```bash
pnpm add openai electron-store use-ear react react-dom
```

- [ ] **Step 4: Add dev deps**

```bash
pnpm add -D vitest happy-dom @vitest/ui @types/react @types/react-dom
```

- [ ] **Step 5: Add `test` and `test:run` scripts to package.json**

```json
"scripts": {
  ...
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 7: Create `.env.example`**

```
# Optional fallback; the app reads the key from settings UI normally.
OPENAI_API_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite react-ts project with deps"
```

---

## Task 2: House-style tooling (Biome, lefthook, commitlint)

**Files:** `biome.json`, `lefthook.yml`, `commitlint.config.js`

- [ ] **Step 1: Install tooling**

```bash
pnpm add -D @biomejs/biome lefthook @commitlint/cli @commitlint/config-conventional secretlint @secretlint/secretlint-rule-preset-recommend
```

- [ ] **Step 2: Initialize Biome**

```bash
pnpm biome init
```
Then edit `biome.json` so `formatter.indentStyle` is `"space"` and `linter.rules.recommended` is `true`. Keep defaults otherwise.

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

- [ ] **Step 5: Add `.secretlintrc.json`**

```json
{ "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }] }
```

- [ ] **Step 6: Install hooks**

```bash
pnpm lefthook install
```

- [ ] **Step 7: Add lint scripts**

In `package.json`:
```json
"scripts": {
  ...
  "lint": "biome check",
  "format": "biome format --write"
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add biome, lefthook, commitlint, secretlint"
```

---

## Task 3: State machine (pure, TDD)

**Files:**
- Create: `src/lib/state-machine.ts`, `src/lib/state-machine.test.ts`

States: `idle`, `listening`, `thinking`, `speaking`, `error`.

Transitions: `wakeDetected` (idle→listening), `speechCaptured` (listening→thinking), `speechTimeout` (listening→idle), `responseReady` (thinking→speaking), `responseFailed` (thinking→error), `speechDone` (speaking→idle), `errorAcknowledged` (error→idle).

- [ ] **Step 1: Write failing tests**

`src/lib/state-machine.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMachine, transition } from "./state-machine";

describe("state-machine", () => {
  it("starts in idle", () => {
    expect(createMachine().state).toBe("idle");
  });

  it("idle → listening on wakeDetected", () => {
    const m = createMachine();
    expect(transition(m, { type: "wakeDetected" }).state).toBe("listening");
  });

  it("listening → thinking on speechCaptured", () => {
    const m = transition(createMachine(), { type: "wakeDetected" });
    expect(transition(m, { type: "speechCaptured", text: "hi" }).state).toBe("thinking");
  });

  it("listening → idle on speechTimeout", () => {
    const m = transition(createMachine(), { type: "wakeDetected" });
    expect(transition(m, { type: "speechTimeout" }).state).toBe("idle");
  });

  it("thinking → speaking on responseReady", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    expect(transition(m, { type: "responseReady", reply: "hello" }).state).toBe("speaking");
  });

  it("thinking → error on responseFailed", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    expect(transition(m, { type: "responseFailed", message: "oops" }).state).toBe("error");
  });

  it("speaking → idle on speechDone", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseReady", reply: "hello" });
    expect(transition(m, { type: "speechDone" }).state).toBe("idle");
  });

  it("error → idle on errorAcknowledged", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseFailed", message: "oops" });
    expect(transition(m, { type: "errorAcknowledged" }).state).toBe("idle");
  });

  it("ignores invalid transitions (returns same machine)", () => {
    const m = createMachine();
    expect(transition(m, { type: "speechDone" })).toBe(m);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
pnpm test:run src/lib/state-machine.test.ts
```
Expected: all fail (module missing).

- [ ] **Step 3: Implement state machine**

`src/lib/state-machine.ts`:
```ts
export type State = "idle" | "listening" | "thinking" | "speaking" | "error";

export type Event =
  | { type: "wakeDetected" }
  | { type: "speechCaptured"; text: string }
  | { type: "speechTimeout" }
  | { type: "responseReady"; reply: string }
  | { type: "responseFailed"; message: string }
  | { type: "speechDone" }
  | { type: "errorAcknowledged" };

export type Machine = { state: State };

export function createMachine(): Machine {
  return { state: "idle" };
}

export function transition(m: Machine, e: Event): Machine {
  switch (m.state) {
    case "idle":
      if (e.type === "wakeDetected") return { state: "listening" };
      return m;
    case "listening":
      if (e.type === "speechCaptured") return { state: "thinking" };
      if (e.type === "speechTimeout") return { state: "idle" };
      return m;
    case "thinking":
      if (e.type === "responseReady") return { state: "speaking" };
      if (e.type === "responseFailed") return { state: "error" };
      return m;
    case "speaking":
      if (e.type === "speechDone") return { state: "idle" };
      return m;
    case "error":
      if (e.type === "errorAcknowledged") return { state: "idle" };
      return m;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm test:run src/lib/state-machine.test.ts
```
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-machine.ts src/lib/state-machine.test.ts
git commit -m "feat: add conversation state machine"
```

---

## Task 4: Conversation history (pure, TDD)

**Files:**
- Create: `src/lib/conversation-history.ts`, `src/lib/conversation-history.test.ts`

Stores chat messages, applies a sliding cap of 20 non-system messages, exposes the array for OpenAI requests.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { createHistory, addUser, addAssistant, messagesForRequest } from "./conversation-history";

const SYSTEM = "You are Chappie.";

describe("conversation-history", () => {
  it("starts empty (system prompt only)", () => {
    const h = createHistory(SYSTEM);
    expect(messagesForRequest(h)).toEqual([{ role: "system", content: SYSTEM }]);
  });

  it("adds user and assistant messages in order", () => {
    let h = createHistory(SYSTEM);
    h = addUser(h, "hi");
    h = addAssistant(h, "hello");
    expect(messagesForRequest(h)).toEqual([
      { role: "system", content: SYSTEM },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("caps non-system messages at 20, dropping oldest", () => {
    let h = createHistory(SYSTEM);
    for (let i = 0; i < 15; i++) {
      h = addUser(h, `u${i}`);
      h = addAssistant(h, `a${i}`);
    }
    const msgs = messagesForRequest(h);
    expect(msgs[0]).toEqual({ role: "system", content: SYSTEM });
    expect(msgs.length).toBe(21); // system + 20
    expect(msgs[1]).toEqual({ role: "user", content: "u5" }); // first 10 (u0..u4 + a0..a4) dropped
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test:run src/lib/conversation-history.test.ts
```

- [ ] **Step 3: Implement**

`src/lib/conversation-history.ts`:
```ts
export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };
export type History = { systemPrompt: string; messages: Message[] };

const MAX_NON_SYSTEM = 20;

export function createHistory(systemPrompt: string): History {
  return { systemPrompt, messages: [] };
}

export function addUser(h: History, content: string): History {
  return cap({ ...h, messages: [...h.messages, { role: "user", content }] });
}

export function addAssistant(h: History, content: string): History {
  return cap({ ...h, messages: [...h.messages, { role: "assistant", content }] });
}

export function messagesForRequest(h: History): Message[] {
  return [{ role: "system", content: h.systemPrompt }, ...h.messages];
}

function cap(h: History): History {
  if (h.messages.length <= MAX_NON_SYSTEM) return h;
  return { ...h, messages: h.messages.slice(h.messages.length - MAX_NON_SYSTEM) };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversation-history.ts src/lib/conversation-history.test.ts
git commit -m "feat: add in-memory conversation history with sliding cap"
```

---

## Task 5: OpenAI client wrapper (TDD with mocked SDK)

**Files:**
- Create: `src/lib/openai-client.ts`, `src/lib/openai-client.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { createChatClient } from "./openai-client";

describe("openai-client", () => {
  it("sends messages and returns assistant reply text", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "hi back" } }],
    });
    const fakeOpenAI = { chat: { completions: { create } } } as never;
    const client = createChatClient(fakeOpenAI, "gpt-4o-mini");
    const reply = await client.complete([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(reply).toBe("hi back");
    expect(create).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
    });
  });

  it("throws when no choices returned", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [] });
    const fakeOpenAI = { chat: { completions: { create } } } as never;
    const client = createChatClient(fakeOpenAI, "gpt-4o-mini");
    await expect(client.complete([])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

`src/lib/openai-client.ts`:
```ts
import type OpenAI from "openai";
import type { Message } from "./conversation-history";

export type ChatClient = {
  complete: (messages: Message[]) => Promise<string>;
};

export function createChatClient(openai: Pick<OpenAI, "chat">, model: string): ChatClient {
  return {
    async complete(messages) {
      const res = await openai.chat.completions.create({ model, messages });
      const reply = res.choices[0]?.message?.content;
      if (!reply) throw new Error("OpenAI returned no content");
      return reply;
    },
  };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai-client.ts src/lib/openai-client.test.ts
git commit -m "feat: add openai chat client wrapper"
```

---

## Task 6: Settings store (main process)

**Files:**
- Create: `electron/main/settings-store.ts`

- [ ] **Step 1: Implement**

```ts
import Store from "electron-store";

export type Settings = {
  openaiApiKey: string;
  voiceURI: string | null;
};

const store = new Store<Settings>({
  defaults: { openaiApiKey: "", voiceURI: null },
  name: "chappie-settings",
});

export function getSettings(): Settings {
  return { openaiApiKey: store.get("openaiApiKey"), voiceURI: store.get("voiceURI") };
}

export function setSettings(patch: Partial<Settings>): void {
  if (patch.openaiApiKey !== undefined) store.set("openaiApiKey", patch.openaiApiKey);
  if (patch.voiceURI !== undefined) store.set("voiceURI", patch.voiceURI);
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/settings-store.ts
git commit -m "feat: add typed electron-store settings wrapper"
```

---

## Task 7: IPC contracts and preload bridge

**Files:**
- Create: `electron/preload/index.ts` (overwrite scaffold), `src/ipc.ts`
- Modify: `electron/main/index.ts` (register IPC handlers — full content given in Task 9)

- [ ] **Step 1: Define preload bridge**

`electron/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from "electron";

const api = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: { openaiApiKey?: string; voiceURI?: string | null }) =>
    ipcRenderer.invoke("settings:set", patch),
  setTrayState: (state: "idle" | "listening" | "thinking" | "speaking" | "error") =>
    ipcRenderer.invoke("tray:setState", state),
  openSettings: () => ipcRenderer.invoke("window:openSettings"),
};

contextBridge.exposeInMainWorld("api", api);
export type Api = typeof api;
```

- [ ] **Step 2: Define renderer-side typed accessor**

`src/ipc.ts`:
```ts
import type { Api } from "../electron/preload";

declare global {
  interface Window {
    api: Api;
  }
}

export const api = (): Api => window.api;
```

- [ ] **Step 3: Commit**

```bash
git add electron/preload/index.ts src/ipc.ts
git commit -m "feat: define IPC contract via contextBridge"
```

---

## Task 8: Tray module

**Files:**
- Create: `electron/main/tray.ts`
- Add: 5 icon PNGs in `resources/`

- [ ] **Step 1: Drop in tray icons**

Create `resources/tray-idle.png`, `tray-listening.png`, `tray-thinking.png`, `tray-speaking.png`, `tray-error.png` — each a 22x22 (macOS template) or 16x16 (Windows) PNG. For MVP, use simple solid-color circles in the 5 colors:
- idle: gray `#8a8a8a`
- listening: blue `#3b82f6`
- thinking: amber `#f59e0b`
- speaking: green `#10b981`
- error: red `#ef4444`

You can generate these with any tool. Quick option:
```bash
mkdir -p resources
# Use any icon generator or paste pre-made PNGs
```
Verify: `ls resources/tray-*.png` shows 5 files.

- [ ] **Step 2: Implement tray module**

```ts
import { app, Tray, Menu, nativeImage } from "electron";
import path from "node:path";

export type TrayState = "idle" | "listening" | "thinking" | "speaking" | "error";

let tray: Tray | null = null;
let onOpenSettings: () => void = () => {};
let onQuit: () => void = () => app.quit();

const iconFor = (state: TrayState) =>
  path.join(process.resourcesPath || "resources", `tray-${state}.png`);

const labelFor: Record<TrayState, string> = {
  idle: "Chappie: 待機中",
  listening: "Chappie: 聞いています",
  thinking: "Chappie: 考え中",
  speaking: "Chappie: 喋っています",
  error: "Chappie: エラー",
};

export function initTray(opts: { onOpenSettings: () => void; onQuit?: () => void }) {
  onOpenSettings = opts.onOpenSettings;
  if (opts.onQuit) onQuit = opts.onQuit;

  const img = nativeImage.createFromPath(iconFor("idle"));
  if (process.platform === "darwin") img.setTemplateImage(true);
  tray = new Tray(img);
  setTrayState("idle");
}

export function setTrayState(state: TrayState) {
  if (!tray) return;
  const img = nativeImage.createFromPath(iconFor(state));
  if (process.platform === "darwin") img.setTemplateImage(true);
  tray.setImage(img);
  tray.setToolTip(labelFor[state]);
  const menu = Menu.buildFromTemplate([
    { label: labelFor[state], enabled: false },
    { type: "separator" },
    { label: "設定…", click: onOpenSettings },
    { label: "終了", click: onQuit },
  ]);
  tray.setContextMenu(menu);
}
```

- [ ] **Step 3: Commit**

```bash
git add electron/main/tray.ts resources/
git commit -m "feat: add tray icon with state-based image and menu"
```

---

## Task 9: Main process orchestration

**Files:**
- Modify: `electron/main/index.ts` (replace scaffold contents)

- [ ] **Step 1: Replace `electron/main/index.ts`**

```ts
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { initTray, setTrayState, type TrayState } from "./tray";
import { getSettings, setSettings } from "./settings-store";

let workerWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const PRELOAD = path.join(__dirname, "../preload/index.js");
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_FILE = path.join(__dirname, "../renderer/index.html");

function loadRenderer(win: BrowserWindow, view: "conversation" | "settings") {
  if (RENDERER_URL) {
    win.loadURL(`${RENDERER_URL}?view=${view}`);
  } else {
    win.loadFile(RENDERER_FILE, { query: { view } });
  }
}

function createWorkerWindow() {
  workerWindow = new BrowserWindow({
    show: false,
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  loadRenderer(workerWindow, "conversation");
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 360,
    title: "Chappie 設定",
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  loadRenderer(settingsWindow, "settings");
}

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:set", (_e, patch) => {
    setSettings(patch);
    return getSettings();
  });
  ipcMain.handle("tray:setState", (_e, state: TrayState) => setTrayState(state));
  ipcMain.handle("window:openSettings", () => openSettingsWindow());

  initTray({ onOpenSettings: openSettingsWindow });
  createWorkerWindow();
});

app.on("window-all-closed", (e: Event) => {
  // Tray-only app: never quit on window close.
  e.preventDefault();
});
```

- [ ] **Step 2: Manual smoke test**

```bash
pnpm dev
```
Expected:
- No dock/taskbar window appears
- Tray icon appears (gray circle)
- Right-clicking tray shows menu with `設定…` and `終了`
- `終了` quits the app
- `設定…` opens an empty settings window (form not built yet)

- [ ] **Step 3: Commit**

```bash
git add electron/main/index.ts
git commit -m "feat: wire main process — tray, hidden worker window, settings window, IPC"
```

---

## Task 10: Renderer routing and Settings view

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`
- Create: `src/views/SettingsView.tsx`, `src/views/ConversationView.tsx` (stub for now)

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { SettingsView } from "./views/SettingsView";
import { ConversationView } from "./views/ConversationView";

function getView(): "conversation" | "settings" {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "settings" ? "settings" : "conversation";
}

export function App() {
  const [view] = useState(getView());
  useEffect(() => {
    document.title = view === "settings" ? "Chappie 設定" : "Chappie";
  }, [view]);
  return view === "settings" ? <SettingsView /> : <ConversationView />;
}
```

- [ ] **Step 2: Create `src/views/SettingsView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../ipc";

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api()
      .getSettings()
      .then((s) => {
        setApiKey(s.openaiApiKey);
        setVoiceURI(s.voiceURI);
      });
    const refreshVoices = () => setVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  const onSave = async () => {
    await api().setSettings({ openaiApiKey: apiKey, voiceURI });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18 }}>Chappie 設定</h1>
      <label style={{ display: "block", marginTop: 12 }}>
        OpenAI API キー
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        読み上げ音声
        <select
          value={voiceURI ?? ""}
          onChange={(e) => setVoiceURI(e.target.value || null)}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        >
          <option value="">（システム既定）</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>
      <button onClick={onSave} style={{ marginTop: 16 }}>
        保存
      </button>
      {saved && <span style={{ marginLeft: 8 }}>保存しました</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create stub `src/views/ConversationView.tsx`**

```tsx
export function ConversationView() {
  return <div>Chappie worker (hidden)</div>;
}
```

- [ ] **Step 4: Manual verify**

```bash
pnpm dev
```
- Open settings from tray menu → form appears.
- Type a fake API key, pick a voice, click 保存 → "保存しました" appears.
- Close and reopen settings → values persist.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/App.tsx src/views/
git commit -m "feat: add settings view with API key and voice selection"
```

---

## Task 11: Speech synthesis wrapper

**Files:**
- Create: `src/lib/speech-synthesis.ts`, `src/lib/speech-synthesis.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { speak } from "./speech-synthesis";

describe("speak", () => {
  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn((u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onend?.(new Event("end") as never), 0);
      }),
      getVoices: () => [],
      cancel: vi.fn(),
    });
    // @ts-expect-error stub utterance constructor
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; voice: SpeechSynthesisVoice | null = null; lang = ""; onend?: (e: Event) => void; onerror?: (e: Event) => void; constructor(t: string) { this.text = t; } });
  });

  it("resolves when utterance ends", async () => {
    await expect(speak("hello", null)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```ts
export function speak(text: string, voiceURI: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      }
    }
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(new Error(`speech synthesis error: ${(e as SpeechSynthesisErrorEvent).error}`));
    window.speechSynthesis.speak(utter);
  });
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/speech-synthesis.ts src/lib/speech-synthesis.test.ts
git commit -m "feat: add Promise-based speechSynthesis wrapper"
```

---

## Task 12: Command recognition wrapper

**Files:**
- Create: `src/lib/command-recognition.ts`

This wraps the post-wake `SpeechRecognition`. It returns a Promise that resolves with the captured text or rejects with `"timeout"` after `timeoutMs`.

- [ ] **Step 1: Implement**

```ts
type SR = typeof window & {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
};

export function captureCommand(opts: {
  language: string;
  timeoutMs: number;
}): Promise<string> {
  const Ctor =
    (window as SR).SpeechRecognition ?? (window as SR).webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error("SpeechRecognition unsupported"));

  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = opts.language;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      try { rec.stop(); } catch {}
      fn();
    };

    const timer = setTimeout(() => settle(() => reject(new Error("timeout"))), opts.timeoutMs);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      clearTimeout(timer);
      const text = e.results[0]?.[0]?.transcript ?? "";
      settle(() => (text ? resolve(text) : reject(new Error("empty"))));
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      settle(() => reject(new Error(`recognition error: ${(e as SpeechRecognitionErrorEvent).error}`)));
    };
    rec.onend = () => {
      clearTimeout(timer);
      settle(() => reject(new Error("ended without result")));
    };

    rec.start();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/command-recognition.ts
git commit -m "feat: add Promise-based SpeechRecognition wrapper for post-wake capture"
```

(Note: not unit-tested — it depends on the live `SpeechRecognition` global. Verified via Task 14 manual run.)

---

## Task 13: Conversation loop hook

**Files:**
- Create: `src/hooks/useConversationLoop.ts`
- Modify: `src/views/ConversationView.tsx`

This is the orchestrator. Wires `use-ear` → `captureCommand` → `openai-client` → `speak` and pushes tray state on every transition.

- [ ] **Step 1: Implement `useConversationLoop`**

```ts
import { useEffect, useRef, useState } from "react";
import { useEar } from "use-ear";
import OpenAI from "openai";
import { api } from "../ipc";
import { createMachine, transition, type Machine } from "../lib/state-machine";
import {
  createHistory,
  addUser,
  addAssistant,
  messagesForRequest,
  type History,
} from "../lib/conversation-history";
import { createChatClient } from "../lib/openai-client";
import { captureCommand } from "../lib/command-recognition";
import { speak } from "../lib/speech-synthesis";

const WAKE_WORD = "chappie";
const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud.";
const COMMAND_TIMEOUT_MS = 6000;

export function useConversationLoop() {
  const [machine, setMachine] = useState<Machine>(createMachine());
  const historyRef = useRef<History>(createHistory(SYSTEM_PROMPT));
  const apiKeyRef = useRef<string>("");
  const voiceURIRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  // Load + watch settings
  useEffect(() => {
    api().getSettings().then((s) => {
      apiKeyRef.current = s.openaiApiKey;
      voiceURIRef.current = s.voiceURI;
    });
  }, []);

  // Push tray state on every machine change
  useEffect(() => {
    api().setTrayState(machine.state);
  }, [machine.state]);

  const ear = useEar({
    wakeWords: [WAKE_WORD],
    language: "en-US",
    continuous: true,
    onWakeWord: () => {
      if (busyRef.current) return;
      busyRef.current = true;
      void runTurn();
    },
  });

  // Start ear once
  useEffect(() => {
    if (ear.isSupported) ear.start();
    return () => ear.stop();
  }, [ear.isSupported]);

  async function runTurn() {
    try {
      ear.stop();
      setMachine((m) => transition(m, { type: "wakeDetected" }));

      let userText: string;
      try {
        userText = await captureCommand({
          language: "ja-JP",
          timeoutMs: COMMAND_TIMEOUT_MS,
        });
      } catch (e) {
        setMachine((m) => transition(m, { type: "speechTimeout" }));
        return;
      }

      setMachine((m) => transition(m, { type: "speechCaptured", text: userText }));

      if (!apiKeyRef.current) {
        await speak("OpenAI APIキーが未設定です。設定画面から登録してください。", voiceURIRef.current);
        setMachine((m) => transition(m, { type: "responseFailed", message: "no api key" }));
        setMachine((m) => transition(m, { type: "errorAcknowledged" }));
        return;
      }

      const openai = new OpenAI({ apiKey: apiKeyRef.current, dangerouslyAllowBrowser: true });
      const client = createChatClient(openai, MODEL);

      historyRef.current = addUser(historyRef.current, userText);

      let reply: string;
      try {
        reply = await client.complete(messagesForRequest(historyRef.current));
      } catch (e) {
        await speak("うまく繋がりませんでした。", voiceURIRef.current);
        setMachine((m) => transition(m, { type: "responseFailed", message: String(e) }));
        setMachine((m) => transition(m, { type: "errorAcknowledged" }));
        return;
      }

      historyRef.current = addAssistant(historyRef.current, reply);
      setMachine((m) => transition(m, { type: "responseReady", reply }));

      try {
        await speak(reply, voiceURIRef.current);
      } catch {
        // Ignore TTS errors; still go back to idle.
      }
      setMachine((m) => transition(m, { type: "speechDone" }));
    } finally {
      busyRef.current = false;
      try { ear.start(); } catch {}
    }
  }

  return { state: machine.state, isSupported: ear.isSupported };
}
```

- [ ] **Step 2: Replace `src/views/ConversationView.tsx`**

```tsx
import { useConversationLoop } from "../hooks/useConversationLoop";

export function ConversationView() {
  const { state, isSupported } = useConversationLoop();
  return (
    <div style={{ padding: 8, fontFamily: "system-ui, sans-serif" }}>
      <div>Chappie worker</div>
      <div>状態: {state}</div>
      {!isSupported && <div style={{ color: "red" }}>Web Speech API 非対応の環境です</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/ src/views/ConversationView.tsx
git commit -m "feat: wire conversation loop — wake word, STT, OpenAI, TTS, tray sync"
```

---

## Task 14: Manual end-to-end verification

- [ ] **Step 1: Set API key**

```bash
pnpm dev
```
Open tray → 設定… → paste a real OpenAI API key → 保存 → close.

- [ ] **Step 2: Wake-word smoke test**

In a quiet room, say `"chappie"` clearly. Expected sequence:
1. Tray icon turns blue (listening). Within 6 seconds say a sentence ending with a clear pause, e.g., `"今何時？"`.
2. Tray icon turns amber (thinking).
3. Tray icon turns green (speaking) and the system voice reads OpenAI's reply.
4. Tray icon returns to gray (idle).

- [ ] **Step 3: Multi-turn context**

Say `"chappie"` → `"私の名前は河村です。"` → wait for reply.
Say `"chappie"` → `"私の名前を覚えてる？"` → reply should reference 河村.

- [ ] **Step 4: False wake**

Say `"chappie"` and stay silent for 7+ seconds. Tray returns to idle without speaking.

- [ ] **Step 5: Quit retains nothing**

Quit from tray menu. Restart `pnpm dev`. Wake again, ask for the name. Reply should NOT remember 河村 (history is per-process).

- [ ] **Step 6: Commit nothing**

This task produces no code changes — only sign-off in the checklist.

---

## Task 15: Build and package

**Files:**
- Modify: `package.json` (add build scripts), `electron-builder.yml` (created by scaffold or add it)

- [ ] **Step 1: Confirm electron-builder is present**

`pnpm electron-builder --version` should print a version. (electron-vite scaffold includes it.) If missing: `pnpm add -D electron-builder`.

- [ ] **Step 2: Verify `electron-builder.yml`**

If not present, create:
```yaml
appId: io.kkweb.chappie
productName: Chappie
directories:
  output: release/${version}
files:
  - "out/**"
mac:
  category: public.app-category.productivity
  target: dmg
win:
  target: nsis
extraResources:
  - from: resources
    to: .
    filter: ["tray-*.png"]
```

- [ ] **Step 3: Build for macOS (when on macOS)**

```bash
pnpm build
pnpm electron-builder --mac --config electron-builder.yml
```
Expected: `release/<version>/Chappie-<version>.dmg` produced.

- [ ] **Step 4: Smoke-test the dmg**

Open the dmg, drag Chappie.app to /Applications, launch. Tray icon appears. Open settings, paste key, run a wake-word turn.

- [ ] **Step 5: Build for Windows (deferred if not on Windows)**

```bash
pnpm electron-builder --win --config electron-builder.yml
```
Smoke-test the produced installer on a Windows machine.

- [ ] **Step 6: Commit**

```bash
git add package.json electron-builder.yml
git commit -m "chore: configure electron-builder for mac/win packaging"
```

---

## Task 16: README and project metadata

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```md
# Chappie Desktop

ハンズフリー音声AIアシスタント。ウェイクワード「chappie」で起動して声だけで会話できる、トレイ常駐のElectronアプリ。

## 開発

```bash
pnpm install
pnpm dev
```

トレイアイコンから設定を開いてOpenAI APIキーを登録すると会話が始められる。

## ビルド

```bash
pnpm build
pnpm electron-builder --mac    # or --win
```

## ライセンス
MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-review notes

- All spec sections (§1〜§11) map to tasks: コンセプト/ターゲット/差別化軸はREADME(Task 16)。MVPスコープ含むはTask 3-13。スタックはTask 1。プラットフォーム/ビルドはTask 15。動作フローはTask 13の `useConversationLoop`。UIはTask 8/9/10。エラー時の振る舞いはTask 13(`responseFailed`分岐, command timeout, no-API-key gate)+Task 9(no window-close quit)。トレードオフ・拡張余地はドキュメントのみで、実装は不要。
- Wake word value (`"chappie"`), default model (`gpt-4o-mini`), system prompt, history cap (20), command timeout (6s) are all defined in "Decisions locked" and reused consistently across tasks 4/5/13.
- Type names match across files: `Settings`, `Message`, `History`, `Machine`, `State`, `Event`, `TrayState`, `Api`.
- Microphone permission: macOS prompts on first SpeechRecognition use; the user just allows it. Documented in Task 14 step 2 implicitly (the system prompt appears).
