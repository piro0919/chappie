import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

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
