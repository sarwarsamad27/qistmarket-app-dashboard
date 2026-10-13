"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { LIVE_RESYNC_EVENT } from "./liveEvents";

export { LIVE_RESYNC_EVENT };

interface LiveRefreshOptions {
  /** Socket events that mean "this page's data changed". */
  events?: string[];
  /** At most one refresh per this many ms (busy days emit constantly). Default 60s. */
  minGapMs?: number;
  /** Wait this long after an event before refreshing, to batch a burst. Default 2s. */
  debounceMs?: number;
}

/**
 * Keeps a page's data live: calls `refresh` when one of `events` arrives on the shared
 * socket, and after a reconnect / network return / tab coming back. Throttled, and held
 * while the tab is hidden (it runs once when the tab is shown again).
 */
export function useLiveRefresh(refresh: () => void, { events = [], minGapMs = 60 * 1000, debounceMs = 2000 }: LiveRefreshOptions = {}) {
  const { socket } = useNotifications();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const eventsKey = events.join("|");

  useEffect(() => {
    let lastRefresh = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingWhileHidden = false;

    const run = () => {
      timer = null;
      if (document.hidden) { pendingWhileHidden = true; return; }
      lastRefresh = Date.now();
      refreshRef.current();
    };
    const schedule = (immediate = false) => {
      if (timer) {
        if (!immediate) return;
        clearTimeout(timer);
      }
      const wait = immediate ? 0 : Math.max(debounceMs, lastRefresh + minGapMs - Date.now());
      timer = setTimeout(run, wait);
    };
    const onEvent = () => schedule(false);
    // A resync means data was possibly missed — don't make it wait out the throttle.
    const onResync = () => schedule(true);
    const onVisible = () => {
      if (!document.hidden && pendingWhileHidden) {
        pendingWhileHidden = false;
        schedule(true);
      }
    };

    const names = eventsKey ? eventsKey.split("|") : [];
    names.forEach((e) => socket?.on(e, onEvent));
    window.addEventListener(LIVE_RESYNC_EVENT, onResync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      names.forEach((e) => socket?.off(e, onEvent));
      window.removeEventListener(LIVE_RESYNC_EVENT, onResync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [socket, eventsKey, minGapMs, debounceMs]);
}
