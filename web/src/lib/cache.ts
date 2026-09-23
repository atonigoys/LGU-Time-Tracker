"use client";

import { useSyncExternalStore } from "react";
import { call } from "./api";
import { DATA_CHANGED_EVENT } from "./events";
import { getSession } from "./storage";
import { manilaToday } from "./format";

/**
 * Read cache for Apps Script calls. Every request costs seconds, so pages
 * show the last response they got right away and refresh it in the
 * background (stale-while-revalidate). Identical requests already in flight
 * are shared instead of sent twice.
 *
 * Stored in localStorage per user and wiped on logout (see clearReadCache).
 */

const PREFIX = "lgu_cache:v1:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Data this recent is used as-is without a background refresh (e.g. the home
// page data that arrived with the login response a moment ago).
const FRESH_MS = 20 * 1000;

const inflight = new Map<string, Promise<unknown>>();

function cacheKey(action: string, payload: Record<string, unknown>) {
  const user = getSession()?.user.employeeId ?? "anon";
  // Scoped to the Manila date so "today" data from yesterday is never shown as today's.
  return `${PREFIX}${manilaToday()}:${user}:${action}:${JSON.stringify(payload)}`;
}

function readEntry<T>(key: string): { at: number; data: T; stale?: boolean } | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as { at: number; data: T; stale?: boolean };
    if (Date.now() - entry.at > MAX_AGE_MS) return undefined;
    return entry;
  } catch {
    return undefined;
  }
}

let prunedFor = "";

/** Drops entries from previous days (keys are date-scoped) once per day per tab. */
function pruneOldDays() {
  const today = manilaToday();
  if (prunedFor === today) return;
  prunedFor = today;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX) && !k.startsWith(`${PREFIX}${today}:`)) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

function writeCache(key: string, data: unknown) {
  pruneOldDays();
  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Storage full or blocked - caching is only an optimization.
  }
}

/** Removes every cached response (all users). Called on logout / account switch. */
export function clearReadCache() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
  inflight.clear();
}

/**
 * After any change on the server, every cached response may be outdated.
 * Keep the data (pages can still show it instantly) but mark it old so the
 * next read always goes to the server, and drop in-flight reads that may
 * have started before the change.
 */
function markAllStale() {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { at: number; data: unknown; stale?: boolean };
      entry.stale = true;
      window.localStorage.setItem(k, JSON.stringify(entry));
    }
  } catch {
    // ignore
  }
  inflight.clear();
}
if (typeof window !== "undefined") window.addEventListener(DATA_CHANGED_EVENT, markAllStale);

// --- "Updating…" indicator: counts background refreshes of data already on screen.
let refreshing = 0;
const listeners = new Set<() => void>();
function setRefreshing(delta: number) {
  refreshing = Math.max(0, refreshing + delta);
  listeners.forEach((l) => l());
}
export function useBackgroundRefreshing(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => refreshing > 0,
    () => false
  );
}

/** True if a response for this request is cached today or already being fetched. */
export function hasCachedOrPending(action: string, payload: Record<string, unknown> = {}) {
  const key = cacheKey(action, payload);
  return inflight.has(key) || readEntry(key) !== undefined;
}

/** Stores a response obtained some other way (e.g. bundled with login). */
export function seedCache(action: string, payload: Record<string, unknown>, data: unknown) {
  writeCache(cacheKey(action, payload), data);
}

/** Starts a fetch unless a fresh copy is already cached or one is in flight. */
export function prefetch(action: string, payload: Record<string, unknown> = {}) {
  const entry = readEntry(cacheKey(action, payload));
  if (entry && !entry.stale && Date.now() - entry.at < FRESH_MS) return;
  fetchAndCache(action, payload).catch(() => {});
}

/** Fetches (or joins an identical in-flight fetch) and saves the result. */
export function fetchAndCache<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const key = cacheKey(action, payload);
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = call<T>(action, payload)
    .then((data) => {
      writeCache(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Calls onData with the cached response (if any) as soon as possible, then
 * again with the fresh one. Resolves with the fresh response; rejects if the
 * fresh request fails (cached data, if shown, stays on screen).
 */
export function cachedCall<T>(
  action: string,
  payload: Record<string, unknown>,
  onData: (data: T, fromCache: boolean) => void
): Promise<T> {
  const entry = readEntry<T>(cacheKey(action, payload));
  const cached = entry?.data;
  if (entry && !entry.stale && Date.now() - entry.at < FRESH_MS) {
    // Just fetched - use it without another round trip.
    return Promise.resolve().then(() => {
      onData(entry.data, false);
      return entry.data;
    });
  }
  if (cached !== undefined) {
    // Deliver asynchronously so callers can safely set state from effects.
    Promise.resolve().then(() => onData(cached, true));
    setRefreshing(1);
  }
  return fetchAndCache<T>(action, payload)
    .then((fresh) => {
      onData(fresh, false);
      return fresh;
    })
    .finally(() => {
      if (cached !== undefined) setRefreshing(-1);
    });
}
