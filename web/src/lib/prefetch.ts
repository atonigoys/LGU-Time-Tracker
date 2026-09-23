"use client";

import { prefetch, seedCache } from "./cache";
import { addDays, manilaToday } from "./format";
import type { Role } from "./types";

/** The dashboard's 7-day chart request; shared so the prefetch hits the same cache entry. */
export function weeklyReportPayload() {
  const today = manilaToday();
  return { type: "daily", filters: { dateFrom: addDays(today, -6), dateTo: today } };
}

/**
 * Makes the home page's data available as soon as possible after login:
 * stores whatever the login response already included, then fetches the
 * rest so it's running (or done) by the time the dashboard asks.
 */
export function prefetchHome(role: Role, home?: Record<string, unknown>) {
  const h = home ?? {};
  const week = weeklyReportPayload();
  const seeded = (action: string, payload: Record<string, unknown> = {}) => {
    if (h[action] === undefined) return false;
    if (action === "getReport" && (h.weekFrom !== week.filters.dateFrom || h.weekTo !== week.filters.dateTo)) return false;
    seedCache(action, payload, h[action]);
    return true;
  };
  const ensure = (action: string, payload: Record<string, unknown> = {}) => {
    if (!seeded(action, payload)) prefetch(action, payload);
  };
  if (role === "Employee") {
    ensure("getMyTodayStatus");
    ensure("getMyAttendance");
    ensure("getMyQR");
  } else {
    ensure("getTodayStats");
    ensure("getReport", week);
    ensure("getDepartments");
    ensure("getEmployees");
  }
}
