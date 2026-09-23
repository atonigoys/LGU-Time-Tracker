"use client";

import { useEffect, useState } from "react";
import { cachedCall } from "./cache";
import type { Employee, Role } from "./types";

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  href: string;
}

// Apps Script calls take seconds, so the header shouldn't refetch on every
// page navigation. Cache the result for a few minutes across pages.
const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; items: AppNotification[] } | null = null;

function toNotifications(employees: Employee[]): AppNotification[] {
  const pending = employees.filter((e) => e.Status === "Pending").length;
  if (!pending) return [];
  return [
    {
      id: "pending-accounts",
      title: `${pending} account${pending === 1 ? "" : "s"} awaiting approval`,
      detail: "New self-registered employees need Admin or HR review.",
      href: "/employees",
    },
  ];
}

/** Real notifications from backend data. Only Admin/HR have any today. */
export function useNotifications(role: Role | undefined) {
  const canSee = role === "Admin" || role === "HR";
  const [items, setItems] = useState<AppNotification[]>(cache?.items ?? []);

  useEffect(() => {
    if (!canSee) return;
    if (cache && Date.now() - cache.at < CACHE_MS) return;
    let cancelled = false;
    // Shares the Employees page's cached list and in-flight request.
    cachedCall<{ employees: Employee[] }>("getEmployees", {}, (res) => {
      const next = toNotifications(res.employees);
      cache = { at: Date.now(), items: next };
      if (!cancelled) setItems(next);
    }).catch(() => {
      // Notifications are non-essential; stay quiet if they can't load.
    });
    return () => {
      cancelled = true;
    };
  }, [canSee]);

  return canSee ? items : [];
}
