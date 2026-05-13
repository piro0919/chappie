// Cancellable Tauri event-listener subscription. Wraps the
// async-listen → cleanup-on-unmount lifecycle three of the listeners
// in useConversationLoop used to hand-roll identically.
//
// The handler is stored in a ref so its closure can always reach the
// latest hook state without re-subscribing on every render. Subscription
// happens once per mounted component (per event name).

import { type EventCallback, listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export function useTauriListener<T>(
  event: string,
  handler: EventCallback<T>,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const off = await listen<T>(event, (e) => handlerRef.current(e));
      if (cancelled) {
        off();
        return;
      }
      unlisten = off;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [event]);
}
