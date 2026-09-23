import type { Session } from "./types";
import { clearReadCache } from "./cache";

/**
 * Sessions are per tab: each tab keeps its own login in sessionStorage, so an
 * admin and an employee can be signed in side by side in two tabs, and a
 * refresh keeps the tab's own account.
 *
 * With "Remember me", the login is also saved in localStorage so that new
 * tabs (and reopening the browser) start signed in as the most recent login.
 */
export const SESSION_KEY = "lgu_session";
// Set in a tab that signed out or chose "Switch account", so it doesn't
// immediately adopt the remembered login again. Cleared on the next login.
const NO_ADOPT_KEY = "lgu_no_adopt";

function tabStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function sharedStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(store: Storage | null): Session | null {
  try {
    const raw = store?.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const tab = tabStore();
  const own = read(tab);
  if (own) return own;
  if (tab?.getItem(NO_ADOPT_KEY)) return null;
  // A new tab adopts the remembered login once, then keeps it as its own.
  const remembered = read(sharedStore());
  if (remembered) tabStore()?.setItem(SESSION_KEY, JSON.stringify(remembered));
  return remembered;
}

/**
 * remember: true saves it for new tabs, false keeps it to this tab only,
 * undefined (profile updates) keeps whatever was chosen at login.
 */
export function setSession(session: Session, remember?: boolean) {
  const tab = tabStore();
  const shared = sharedStore();
  if (!tab) return;
  // A different person signing in must not see cached pages from before.
  if (read(tab)?.user.employeeId !== session.user.employeeId) clearReadCache();
  const json = JSON.stringify(session);
  tab.setItem(SESSION_KEY, json);
  tab.removeItem(NO_ADOPT_KEY);
  if (remember === true) {
    shared?.setItem(SESSION_KEY, json);
  } else if (remember === false) {
    if (read(shared)?.token === session.token) shared?.removeItem(SESSION_KEY);
  } else if (read(shared)?.token === session.token) {
    shared?.setItem(SESSION_KEY, json);
  }
}

export function clearSession() {
  const tab = tabStore();
  const shared = sharedStore();
  const token = read(tab)?.token;
  tab?.removeItem(SESSION_KEY);
  tab?.setItem(NO_ADOPT_KEY, "1");
  // Forget the remembered login only if it's the one this tab is signing out of.
  if (token && read(shared)?.token === token) shared?.removeItem(SESSION_KEY);
  clearReadCache();
}

/**
 * "Switch account": signs only this tab out, leaving the account signed in
 * everywhere else (other tabs and the remembered login are untouched).
 */
export function forgetTabSession() {
  const tab = tabStore();
  tab?.removeItem(SESSION_KEY);
  tab?.setItem(NO_ADOPT_KEY, "1");
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}
