"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import type { AuditLog } from "@/lib/types";

export default function AuditLogsPage() {
  const session = useRequireAuth(["Admin"]);
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!session) return;
    cachedCall<{ logs: AuditLog[] }>("getAuditLogs", {}, (res) => setLogs(res.logs))
      .catch((err) => toast(err instanceof Error ? err.message : "Failed to load logs.", true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => !q || l.UserID.toLowerCase().includes(q) || l.Action.toLowerCase().includes(q));
  }, [logs, search]);

  if (!session) return null;

  return (
    <AppShell title="Audit Logs">
      <div className={cls.panel}>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className={`${cls.panelTitle} mb-0`}>Recent Administrative Activity</div>
          <input
            placeholder="Filter by user or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${cls.input} max-w-[260px]`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Timestamp</th>
                <th className={cls.th}>User</th>
                <th className={cls.th}>Action</th>
                <th className={cls.th}>Target</th>
                <th className={cls.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cls.emptyState}>
                    No matching log entries.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.LogID}>
                    <td className={cls.td}>{new Date(l.Timestamp).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
                    <td className={cls.td}>{l.UserID}</td>
                    <td className={cls.td}>{l.Action}</td>
                    <td className={cls.td}>{l.Target}</td>
                    <td className="max-w-[320px] border-b border-gray-100 px-3 py-2.5 text-[11.5px] whitespace-normal text-gray-600">
                      {[l.OldValue, l.NewValue].filter(Boolean).join(" → ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
