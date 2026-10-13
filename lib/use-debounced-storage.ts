"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Persists `value` to localStorage after typing pauses instead of on every keystroke.
 * Pending writes are flushed when the page is hidden/closed or the component unmounts,
 * so drafts are never lost.
 */
export function useDebouncedLocalStorage(key: string, value: unknown, enabled: boolean, delayMs = 400) {
  const pendingRef = useRef<{ key: string; value: unknown } | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    try {
      localStorage.setItem(pending.key, JSON.stringify(pending.value));
    } catch {
      // Storage full or unavailable (private mode) — drafts are best-effort.
    }
  }, []);

  const discard = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    pendingRef.current = { key, value };
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, delayMs);
  }, [key, value, enabled, delayMs, flush]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [flush]);

  return { flush, discard };
}
