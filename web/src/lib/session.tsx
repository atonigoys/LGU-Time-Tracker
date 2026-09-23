"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { call } from "./api";
import * as storage from "./storage";
import type { Role, Session, SessionUser } from "./types";

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setSessionState(storage.getSession());
    setLoading(false);
  }, []);

  useEffect(() => {
    // The session lives in localStorage, which all tabs share, and every API
    // call reads the token from there. If another tab logs in as someone else
    // (or logs out), this tab must switch too - otherwise it keeps showing the
    // old user while its requests run as the new one.
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== storage.SESSION_KEY) return;
      const prev = sessionRef.current;
      const next = storage.getSession();
      if (prev?.token === next?.token) return;
      if (prev && next && prev.user.employeeId !== next.user.employeeId) {
        // Different account: reload so no page keeps the old user's data on screen.
        window.location.replace(homeForRole(next.user.role));
        return;
      }
      setSessionState(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await call<{ token: string; user: SessionUser }>("login", { email, password });
    const next: Session = { token: res.token, user: res.user };
    storage.setSession(next);
    setSessionState(next);
  }, []);

  const logout = useCallback(async () => {
    // Sign out locally right away; telling the server (which only drops the
    // cached token) takes seconds on Apps Script, so it runs in the background.
    const token = storage.getToken();
    storage.clearSession();
    setSessionState(null);
    if (token) call("logout", { token }).catch(() => {});
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const next: Session = { ...prev, user: { ...prev.user, ...patch } };
      storage.setSession(next);
      return next;
    });
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, login, logout, updateUser }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}

export function homeForRole(role: Role) {
  return role === "Employee" ? "/employee-dashboard" : "/dashboard";
}

/**
 * Guards a page: redirects to /login if there's no session, or to the
 * user's own home page if their role isn't in allowedRoles. Returns the
 * session once it's safe to render (null while redirecting/loading).
 */
export function useRequireAuth(allowedRoles?: Role[]): Session | null {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      router.replace(homeForRole(session.user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, router]);

  if (loading || !session) return null;
  if (allowedRoles && !allowedRoles.includes(session.user.role)) return null;
  return session;
}
