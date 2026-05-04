"use client";

import useSWR from "swr";

/**
 * Invisible component that preloads key data into SWR cache
 * on app startup. Pages that use the same SWR keys will get
 * instant data from cache instead of fetching again.
 */
export function Prefetch() {
  // User info (used by sidebar, briefing)
  useSWR("/api/user/me");

  // Calendar events (used by briefing)
  useSWR("/api/calendar/events?days=7");

  // Gmail status (used by prospecting)
  useSWR("/api/gmail/status");

  // Deals list - default view (used by deals page)
  useSWR("/api/deals/list?");

  return null;
}
