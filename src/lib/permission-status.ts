// Status string unions for the four macOS permissions chappie asks for.
// Centralized here (rather than inline in SettingsView) so the permission
// rows, the usePermissionStatus hook, and any future consumer share one
// definition instead of re-declaring the same literals.

// Mic / calendar / location follow the AVFoundation-style 4-state model.
export type MicStatus = "granted" | "denied" | "restricted" | "not_determined";
export type CalendarStatus = MicStatus;
export type LocationStatus = MicStatus;

// Screen Recording has no "ask" prompt path — it's a System Settings
// toggle — so it only ever reports granted/denied.
export type ScreenStatus = "granted" | "denied";
