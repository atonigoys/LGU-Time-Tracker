"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { cachedCall, useLiveRefresh } from "@/lib/cache";
import { cls } from "@/lib/ui";
import type { AttendanceRecord, DutyInfo } from "@/lib/types";
import { DutyBadge } from "@/components/DutyStatusDialog";
import { formatDate } from "@/lib/format";

export default function EmployeeDashboardPage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();

  const [greeting, setGreeting] = useState("Hello!");
  const [dateLine, setDateLine] = useState("–");
  const [clock, setClock] = useState("--:--:--");
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [duty, setDuty] = useState<DutyInfo | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [offsetMs, setOffsetMs] = useState(0);

  const load = () => {
    if (!session) return;
    const firstName = session.user.fullName.split(" ")[0];

    cachedCall<{ today: AttendanceRecord | null; duty?: DutyInfo; serverDate: string; serverTime: string }>("getMyTodayStatus", {}, (res, fromCache) => {
        const serverNow = new Date(`${res.serverDate} ${res.serverTime}`);
        // A cached server time is stale; only sync the clock from a fresh response.
        if (!fromCache) setOffsetMs(serverNow.getTime() - Date.now());
        const hour = serverNow.getHours();
        const g = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
        setGreeting(`${g}, ${firstName}!`);
        setDateLine(res.serverDate);
        setToday(res.today);
        setDuty(res.duty ?? null);
      }).catch((err) => toast(err instanceof Error ? err.message : "Failed to load status.", true));

    cachedCall<{ attendance: AttendanceRecord[] }>("getMyAttendance", {}, (res) => setHistory(res.attendance.slice(0, 7))).catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useLiveRefresh(load, 60_000, !!session);

  useEffect(() => {
    const tick = () => {
      const now = new Date(Date.now() + offsetMs);
      setClock(now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offsetMs]);

  if (!session) return null;

  return (
    <AppShell title="My Dashboard">
      <div className="mb-4.5 rounded-xl bg-gradient-to-br from-green-800 to-green-600 p-6 text-white">
        <h2 className="text-xl font-bold">{greeting}</h2>
        <div className="text-sm opacity-90">{dateLine}</div>
        {duty && duty.status !== "On Duty" && (
          <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-[13px] text-gray-800">
            <DutyBadge duty={duty} />
            {duty.to && <span>until {formatDate(duty.to, "long")}</span>}
            {duty.note && <span className="text-gray-500">· {duty.note}</span>}
          </div>
        )}
        <div className="mt-2.5 text-3xl font-extrabold">{clock}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white/15 px-3.5 py-3">
            <div className="text-[11px] opacity-85 uppercase">Today&apos;s Status</div>
            <div className="mt-0.5 text-lg font-bold">
              {today ? <StatusBadge status={today.Status} /> : duty && duty.status !== "On Duty" ? duty.status : "Not Timed In"}
            </div>
          </div>
          <div className="rounded-lg bg-white/15 px-3.5 py-3">
            <div className="text-[11px] opacity-85 uppercase">Time In</div>
            <div className="mt-0.5 text-lg font-bold">{today?.TimeIn || "–"}</div>
          </div>
          <div className="rounded-lg bg-white/15 px-3.5 py-3">
            <div className="text-[11px] opacity-85 uppercase">Time Out</div>
            <div className="mt-0.5 text-lg font-bold">{today?.TimeOut || "–"}</div>
          </div>
          <div className="rounded-lg bg-white/15 px-3.5 py-3">
            <div className="text-[11px] opacity-85 uppercase">Total Hours</div>
            <div className="mt-0.5 text-lg font-bold">{today?.TotalHours ? `${today.TotalHours}h` : "–"}</div>
          </div>
        </div>
      </div>

      <div className={cls.panel}>
        <div className="mb-3.5 flex items-center justify-between">
          <div className={`${cls.panelTitle} mb-0`}>Recent Attendance</div>
          <Link href="/my-attendance" className={`${cls.btnSecondary} ${cls.btnSmall}`}>
            View Full DTR
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Date</th>
                <th className={cls.th}>Time In</th>
                <th className={cls.th}>Time Out</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Total Hrs</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cls.emptyState}>
                    No attendance history yet.
                  </td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr key={r.AttendanceID}>
                    <td className={cls.td}>{r.Date}</td>
                    <td className={cls.td}>{r.TimeIn || "-"}</td>
                    <td className={cls.td}>{r.TimeOut || "-"}</td>
                    <td className={cls.td}>
                      <StatusBadge status={r.Status} />
                    </td>
                    <td className={cls.td}>{r.TotalHours || "-"}</td>
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
