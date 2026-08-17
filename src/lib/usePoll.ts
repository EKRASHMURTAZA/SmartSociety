import { useEffect, useRef } from "react";

/**
 * Periodically re-invokes a silent refresh callback.
 * Skips a tick while a previous run is still in flight and swallows errors,
 * so polling never flashes errors or stacks overlapping requests.
 */
export function usePoll(callback: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const tick = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await cbRef.current();
      } catch {
        /* silent background refresh */
      } finally {
        busyRef.current = false;
      }
    };
    const timer = window.setInterval(() => void tick(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
}