"use client";

import { fetchAndCache, hasCachedOrPending, prefetch, seedCache } from "./cache";
import { addDays, manilaToday } from "./format";
import type { Role } from "./types";

/** The dashboard's 7-day chart request; shared so the prefetch hits the same cache entry. */
export function weeklyReportPayload() {
  const today = manilaToday();
  return { type: "daily", filters: { dateFrom: addDays(today, -6), dateTo: today } };
}

/**
 * Default first-load requests for each page. Pages build their initial
 * request from these so the background warm-up below fills the exact same
 * cache entries (keys depend on property order, so keep these the single source).
 */
export function attendanceDefaultFilters() {
  const today = manilaToday();
  return { dateFrom: addDays(today, -29), dateTo: today, department: "" };
}

export function reportsDefaultRange() {
  const today = manilaToday();
  return { dateFrom: addDays(today, -30), dateTo: today };
}

export function myAttendanceDefaultRange() {
  const today = manilaToday();
  return { dateFrom: addDays(today, -60), dateTo: today };
}

function pageRequests(role: Role): Array<[string, Record<string, unknown>]> {
  if (role === "Employee") {
    return [
      ["getMyTodayStatus", {}],
      ["getMyAttendance", {}],
      ["getMyQR", {}],
      ["getLeaves", {}],
      ["getMyAttendance", myAttendanceDefaultRange()],
    ];
  }
  const reqs: Array<[string, Record<string, unknown>]> = [
    ["getTodayStats", {}],
    ["getReport", weeklyReportPayload()],
    ["getDepartments", {}],
    ["getEmployees", {}],
    ["getAttendance", { filters: attendanceDefaultFilters() }],
    ["getSettings", {}],
    ["getHolidays", {}],
    ["getReport", { type: "daily", filters: { ...reportsDefaultRange(), department: "", employeeId: "" } }],
  ];
  reqs.push(["getAnnouncements", { includeArchived: true }], ["getLeaves", {}]);
  if (role === "Admin") reqs.push(["getSchedules", {}], ["getAuditLogs", {}]);
  return reqs;
}

let warmedFor = "";

/**
 * Loads every sidebar page's data in the background, once per tab per day,
 * so switching pages shows data immediately instead of waiting seconds on
 * Apps Script. Starts shortly after the first page so it doesn't compete
 * with that page's own requests, and only a few at a time.
 */
export function warmPages(role: Role, userId: string) {
  const stamp = `${manilaToday()}:${userId}`;
  if (warmedFor === stamp) return;
  warmedFor = stamp;
  setTimeout(() => {
    const queue = pageRequests(role).filter(([a, p]) => !hasCachedOrPending(a, p));
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await fetchAndCache(next[0], next[1]).catch(() => {});
      }
    };
    for (let i = 0; i < 3; i++) worker();
  }, 1500);
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
