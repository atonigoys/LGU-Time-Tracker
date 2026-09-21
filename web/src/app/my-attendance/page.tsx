"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import type { AttendanceRecord } from "@/lib/types";

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function MyAttendancePage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(60));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState<AttendanceRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await call<{ attendance: AttendanceRecord[] }>("getMyAttendance", { dateFrom, dateTo });
      setRows(res.attendance);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load attendance.", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) return null;

  return (
    <AppShell title="My Attendance (DTR)">
      <div className={`${cls.panel} no-print mb-4`}>
        <div className="flex flex-wrap gap-2.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
          <button onClick={load} className={cls.btn}>
            Apply
          </button>
          <button onClick={() => window.print()} className={cls.btnSecondary}>
            Print DTR
          </button>
        </div>
      </div>

      <div className={cls.panel}>
        <div className="mb-3.5 flex items-center justify-between">
          <div className={`${cls.panelTitle} mb-0`}>Daily Time Record</div>
          <span className="text-sm text-gray-500">{rows.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Date</th>
                <th className={cls.th}>Time In</th>
                <th className={cls.th}>Time Out</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Late (min)</th>
                <th className={cls.th}>Total Hrs</th>
                <th className={cls.th}>OT Hrs</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={cls.emptyState}>
                    No attendance records in this range.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.AttendanceID}>
                    <td className={cls.td}>{r.Date}</td>
                    <td className={cls.td}>{r.TimeIn || "-"}</td>
                    <td className={cls.td}>{r.TimeOut || "-"}</td>
                    <td className={cls.td}>
                      <StatusBadge status={r.Status} />
                    </td>
                    <td className={cls.td}>{r.LateMinutes || 0}</td>
                    <td className={cls.td}>{r.TotalHours || "-"}</td>
                    <td className={cls.td}>{r.OvertimeHours || "-"}</td>
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
