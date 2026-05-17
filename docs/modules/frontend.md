# Frontend Modules (`src/`)

Per-module reference for the React / TypeScript renderer. Kept out of [CLAUDE.md](../../CLAUDE.md) so the top-level guide stays scannable.

When you add or significantly change a module, update the matching entry here and the architecture summary in CLAUDE.md.

## Entry / views

- `main.tsx` — routes `?view=settings` → SettingsView, `?view=hud` → HudView, anything else → ConversationView.
- `views/ConversationWorker.tsx` — headless component for the hidden main window. Mounts `useConversationLoop` and renders nothing visible; all diagnostics flow into the Web Inspector console via `lib/log-bridge.ts`.
- `views/SettingsView.tsx` — on-demand settings window opened from the tray menu (mic permission, **speaker recognition (voice enrollment)** paired right after the mic row, screen-recording permission, calendar permission, **Mode radio (Free / Pro / BYOK)** with a conditional inline panel — Pro shows magic-link sign-in + Stripe upgrade button + status; BYOK shows API key entry + provider detection — language picker, VOICEVOX, autostart). The Free radio is disabled while `subscriptionStatus` is entitled — paying and falling back to the 5/day cap is a UX foot-gun, so the user has to sign out from the Pro panel to revert. Optional permissions (screen recording / calendar / location) all share the same neutral-gray badge style for the not-granted state since denial is a legitimate user choice; only the Required mic uses red for actively denied. Voice enrollment follows the Siri / Google Voice Match pattern: 3 prompted phrases × 3s each = 9s total, with live amplitude meter (driven by the `speaker_enroll:level` Rust event) and a privacy reassurance line. Buttons disable while recording / enrolling / downloading the model. The voice picker was removed — voice now follows the language setting automatically.
- `views/HudView.tsx` + `HudView.module.css` + `HudView.global.css` — Raycast-style transparent overlay. Listens for `hud:show` events and fades a cream-pill card in/out (Chappie portrait + text). Avatar swaps based on text content (listening pose for mute / 👂 / errors, talking pose otherwise).

## Hooks

- `hooks/useConversationLoop.ts` — calls `request_microphone_access` → `ensure_model` → `start_listening`, then listens for `speech` events from Rust and dispatches wake-word detection → `chat_complete` (Rust IPC) → TTS-or-HUD → tray sync. The output channel is decided **at the first text chunk** by querying `is_muted`: muted → buffer chunks and call `hud_show` with the full reply at the end (skips streaming TTS); not muted → normal streaming `createStreamingSpeaker`. The same branch covers wake-word ack ("👂 はい" on HUD when muted), API-key-missing errors, the `openai` failure fallback, and the timer-fired announcement. Wraps every `speak()` in `withMutedCapture()` (pause_listening + 350ms cooldown) so the mic pipeline doesn't process Chappie's own voice. After a successful turn, opens a 6s "continuation window" where the next utterance is treated as the body without requiring the wake-word again. Wake ack rotates a randomized list of soft/casual phrases (`はーい` / `なーに？` / `どうしたの？` etc.) so it doesn't sound canned.

## Libraries (`lib/`)

- `lib/state-machine.ts` — pure state machine with 6 top-level states (`initializing` / `idle` / `listening` / `thinking` / `speaking` / `error`). Two states carry sub-flags rolled in from former standalone refs: `listening.awaitingContinuation` (post-turn continuation window and bare-wake "awaiting body" mode) and `speaking.bargeIn` (TTS playing with mic hot for stop-commands). Top-level state names match the Rust tray enum 1:1.
- `lib/conversation-history.ts` — sliding window of the last 20 messages.
- `lib/openai-client.ts` — thin wrapper that calls the Rust `chat_complete` Tauri command (no provider SDK in the renderer; the Rust side picks the right client based on the API key prefix).
- `lib/wake-word.ts` — normalized matching for `chappie` / `チャッピー` plus Whisper homophone variants (`チョッピー` / `Juppie` / etc.).
- `lib/speech-synthesis.ts` — Promise wrapper over `speechSynthesis.speak()`. Default `rate = 1.15` (the macOS Japanese voices feel slow at the spec default).
- `lib/auto-update.ts` — runs at startup. If an update is found and the user dismisses the prompt, calls `set_update_available(true)` so the tray title shows a persistent `🔔` badge until the next successful update + relaunch.
- `lib/settings.ts` — thin wrapper over `tauri-plugin-store`. Exports the pure `resolveMode(storedMode, apiKey, subscriptionStatus, subscriptionEmail)` helper that decides which mode to surface on load. Two non-obvious rules: (1) demote `paid` → `free` only when the user is signed out AND status is not entitled — a signed-in user mid-checkout has `inactive` status but still needs the Pro panel visible to see the Upgrade button; (2) one-time recovery from a pre-v0.12.1 demote bug: `free + signed-in + entitled` is paradoxical (sign-out always clears email and status together), so promote back to `paid`. `loadSettings` persists any resolveMode disagreement so subsequent loads agree without re-running.
- `lib/supabase-client.ts` — Supabase auth + paid-tier glue. `applyAuthCallback` writes magic-link tokens to the store; `refreshStatus` calls `/api/me` and falls back to `auth.refreshSession` on 401. `installDeepLinkHandler` listens for `chappie://auth#…` / `chappie://refresh` from the Rust deep-link bridge and emits `settings:updated` via Tauri's event bus (not `window.dispatchEvent` — that's a DOM event and never reaches the Tauri `listen` consumers).
- `lib/voicevox-speakers.ts` — curated list of 9 character speakers with persona prompts, wake names, and tier. Only ずんだもん is `tier: "free"`; the other 8 default to `paid`. Premium gating reads `subscriptionStatus` (not `mode`), so BYOK + Pro still unlocks the paid speakers.
- `lib/provider.ts` — renderer-side mirror of `provider.rs::detect_from_key` (prefix → provider). Powers the "Detected: {provider}" hint under the API key field.

## i18n

- `i18n/messages.ts` — typed message catalogs for 9 languages plus a `WAKE_ACKS` table for randomized wake-word acknowledgements. `t(lang, key, params?)` does dotted-path lookup with `{name}` substitution. `resolveLanguage("auto")` sniffs `navigator.language`.
- `i18n/useT.ts` — React hook that loads the language from settings, listens for `settings:updated`, and returns a bound `t()`.
