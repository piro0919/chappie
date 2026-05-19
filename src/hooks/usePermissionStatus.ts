import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

// Wraps the macOS permission triplet that every native permission in
// chappie shares: a `check_*` Tauri command that returns the current
// status string, a `request_*` command that triggers the OS prompt,
// and the boolean "request in flight" UI guard. Four permission rows
// in Settings (mic, screen, calendar, location) used to hand-roll the
// same three pieces of state plus two helper functions each.

export interface UsePermissionStatusResult<S extends string> {
  status: S;
  requesting: boolean;
  refresh: () => Promise<void>;
  request: () => Promise<void>;
}

export function usePermissionStatus<S extends string>(opts: {
  initial: S;
  checkCommand: string;
  requestCommand: string;
}): UsePermissionStatusResult<S> {
  const { initial, checkCommand, requestCommand } = opts;
  const [status, setStatus] = useState<S>(initial);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await invoke<S>(checkCommand);
      setStatus(next);
    } catch (e) {
      console.error(`[settings] ${checkCommand} failed`, e);
    }
  }, [checkCommand]);

  // Re-check status whenever the Settings window regains focus. The user
  // typically grants permission externally (System Settings → Privacy)
  // and comes back expecting the badge to update; without this they'd
  // have to close + reopen Settings, so previously every permission row
  // had a manual "Recheck" button. Auto-refresh lets us drop that button
  // and tighten each row.
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      const granted = await invoke<boolean>(requestCommand);
      console.info(`[settings] ${requestCommand} ->`, granted);
      await refresh();
    } catch (e) {
      console.error(`[settings] ${requestCommand} failed`, e);
    } finally {
      setRequesting(false);
    }
  }, [requestCommand, refresh]);

  return { status, requesting, refresh, request };
}
