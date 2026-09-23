import type { Session } from "./types";
import { clearReadCache } from "./cache";

export const SESSION_KEY = "lgu_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  if (typeof window === "undefined") return;
  // A different person signing in on this browser must not see the previous
  // user's cached pages.
  if (getSession()?.user.employeeId !== session.user.employeeId) clearReadCache();
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  clearReadCache();
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}
