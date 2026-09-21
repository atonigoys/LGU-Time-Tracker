"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
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

  useEffect(() => {
    setSessionState(storage.getSession());
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await call<{ token: string; user: SessionUser }>("login", { email, password });
    const next: Session = { token: res.token, user: res.user };
    storage.setSession(next);
    setSessionState(next);
  }, []);

  const logout = useCallback(async () => {
    try {
      await call("logout", {});
    } catch {
      // best-effort - clear locally regardless
    }
    storage.clearSession();
    setSessionState(null);
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
