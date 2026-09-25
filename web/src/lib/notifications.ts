"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cachedCall } from "./cache";
import { DATA_CHANGED_EVENT } from "./events";
import type { Employee, LeaveRequest, Role } from "./types";

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone?: "warning" | "success" | "danger";
}

const REFRESH_MS = 2 * 60 * 1000;
const seenKey = (userId: string) => `lgu_leave_seen:${userId}`;
const toastedKey = (userId: string) => `lgu_leave_toasted:${userId}`;
const SEEN_EVENT = "lgu:leave-decisions-seen";

function loadSet(storage: Storage | undefined, key: string): Set<string> {
  try {
    const raw = storage?.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveSet(storage: Storage | undefined, key: string, set: Set<string>) {
  try {
    storage?.setItem(key, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // non-essential
  }
}
const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const tab = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

/** "2026-09-28".."2026-09-30" -> "Sep 28 – Sep 30" */
function shortRange(from: string, to: string) {
  const f = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

/** Marks every current leave decision as seen (called by the My Leave page). */
export function markLeaveDecisionsSeen(userId: string, leaves: LeaveRequest[]) {
  const seen = loadSet(local(), seenKey(userId));
  let changed = false;
  leaves.forEach((l) => {
    if ((l.Status === "Approved" || l.Status === "Rejected") && l.Source === "Employee" && !seen.has(l.LeaveID)) {
      seen.add(l.LeaveID);
      changed = true;
    }
  });
  if (changed) {
    saveSet(local(), seenKey(userId), seen);
    window.dispatchEvent(new Event(SEEN_EVENT));
  }
}

/**
 * Header notifications built from real data:
 * - Admin/HR: accounts awaiting approval, pending leave requests
 * - Employees: decisions on their leave requests they haven't looked at yet
 * onNewDecision fires once per decision per tab session, for a visible notice.
 */
export function useNotifications(role: Role | undefined, userId: string | undefined, onNewDecision?: (l: LeaveRequest[]) => void) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [unseenDecisions, setUnseenDecisions] = useState(0);
  const leavesRef = useRef<LeaveRequest[]>([]);
  const accountsRef = useRef<AppNotification | null>(null);
  const onNewRef = useRef(onNewDecision);
  useEffect(() => {
    onNewRef.current = onNewDecision;
  }, [onNewDecision]);

  const rebuild = useCallback(() => {
    if (!role || !userId) return;
    const leaves = leavesRef.current;
    const next: AppNotification[] = [];
    if (role === "Admin" || role === "HR") {
      if (accountsRef.current) next.push(accountsRef.current);
      const pending = leaves.filter((l) => l.Status === "Pending").length;
      setPendingLeaves(pending);
      if (pending) {
        next.push({
          id: "pending-leaves",
          title: `${pending} leave request${pending === 1 ? "" : "s"} to review`,
          detail: "Approve or reject them on the Leave Requests page.",
          href: "/leave-requests",
          tone: "warning",
        });
      }
    } else {
      const seen = loadSet(local(), seenKey(userId));
      const unseen = leaves.filter((l) => (l.Status === "Approved" || l.Status === "Rejected") && l.Source === "Employee" && !seen.has(l.LeaveID));
      setUnseenDecisions(unseen.length);
      unseen.forEach((l) =>
        next.push({
          id: `leave-${l.LeaveID}`,
          title: `Your ${l.LeaveType} leave was ${l.Status.toLowerCase()}`,
          detail: `${shortRange(l.StartDate, l.EndDate)}${l.Remarks ? ` · “${l.Remarks}”` : ""}`,
          href: "/my-leave",
          tone: l.Status === "Approved" ? "success" : "danger",
        })
      );
      const toasted = loadSet(tab(), toastedKey(userId));
      const fresh = unseen.filter((l) => !toasted.has(l.LeaveID));
      if (fresh.length) {
        fresh.forEach((l) => toasted.add(l.LeaveID));
        saveSet(tab(), toastedKey(userId), toasted);
        onNewRef.current?.(fresh);
      }
    }
    setItems(next);
  }, [role, userId]);

  useEffect(() => {
    if (!role || !userId) return;
    let cancelled = false;
    const refresh = () => {
      cachedCall<{ leaves: LeaveRequest[] }>("getLeaves", {}, (res) => {
        if (cancelled) return;
        leavesRef.current = res.leaves;
        rebuild();
      }).catch(() => {});
      if (role === "Admin" || role === "HR") {
        // Shares the Employees page's cached list and in-flight request.
        cachedCall<{ employees: Employee[] }>("getEmployees", {}, (res) => {
          if (cancelled) return;
          const pending = res.employees.filter((e) => e.Status === "Pending").length;
          accountsRef.current = pending
            ? {
                id: "pending-accounts",
                title: `${pending} account${pending === 1 ? "" : "s"} awaiting approval`,
                detail: "New self-registered employees need Admin or HR review.",
                href: "/employees",
                tone: "warning",
              }
            : null;
          rebuild();
        }).catch(() => {});
      }
    };
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    const onChange = () => setTimeout(refresh, 400);
    const onSeen = () => rebuild();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener(DATA_CHANGED_EVENT, onChange);
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [role, userId, rebuild]);

  return { items, pendingLeaves, unseenDecisions };
}
