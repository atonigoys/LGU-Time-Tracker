"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, UserCheck, Clock, UserX, Palmtree, LogIn as LogInIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/Badge";
import { SkeletonStatCard, SkeletonTableRows, SkeletonChart } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { WeeklyAttendanceChart, type WeeklyPoint } from "@/components/charts/WeeklyAttendanceChart";
import { DepartmentChart, type DepartmentPoint } from "@/components/charts/DepartmentChart";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { cachedCall, useLiveRefresh } from "@/lib/cache";
import { weeklyReportPayload } from "@/lib/prefetch";
import { addDays } from "@/lib/format";
import { cls } from "@/lib/ui";
import type { AttendanceRecord, Department, TodayStats } from "@/lib/types";

function dayLabel(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short" });
}

export default function DashboardPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();

  const [stats, setStats] = useState<TodayStats | null>(null);
  const [today, setToday] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");

  const [weekly, setWeekly] = useState<WeeklyPoint[] | null>(null);
  const [byDept, setByDept] = useState<DepartmentPoint[] | null>(null);

  const loadStats = useCallback(async () => {
    try {
      await cachedCall<{ stats: TodayStats; today: AttendanceRecord[] }>("getTodayStats", {}, (res) => {
        setStats(res.stats);
        setToday(res.today);
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load stats.", true);
    }
  }, [toast]);

  const loadCharts = useCallback(async () => {
    const payload = weeklyReportPayload();
    try {
      await cachedCall<{ rows: Array<{ Date: string; Status: string; EmployeeID: string; Department: string }> }>(
        "getReport",
        payload,
        (res) => {
          const byDate = new Map<string, { present: number; late: number }>();
          for (let i = 0; i <= 6; i++) byDate.set(addDays(payload.filters.dateFrom, i), { present: 0, late: 0 });
          res.rows.forEach((r) => {
            const bucket = byDate.get(r.Date);
            if (!bucket) return;
            if (r.Status === "PRESENT") bucket.present += 1;
            if (r.Status === "LATE") bucket.late += 1;
          });
          setWeekly(Array.from(byDate.entries()).map(([date, v]) => ({ day: dayLabel(date), ...v })));

          const byDepartment = new Map<string, number>();
          res.rows.forEach((r) => {
            const d = r.Department || "Unassigned";
            byDepartment.set(d, (byDepartment.get(d) ?? 0) + 1);
          });
          setByDept(Array.from(byDepartment.entries()).map(([department, count]) => ({ department, count })));
        }
      );
    } catch {
      setWeekly((w) => w ?? []);
      setByDept((d) => d ?? []);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadStats();
    loadCharts();
    cachedCall<{ departments: Department[] }>("getDepartments", {}, (res) => setDepartments(res.departments)).catch(() => {});
  }, [session, loadStats, loadCharts]);

  useLiveRefresh(() => {
    loadStats();
    loadCharts();
  }, 30_000, !!session);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return today.filter((r) => {
      if (dept && r.Department !== dept) return false;
      if (status && r.Status !== status) return false;
      if (
        q &&
        !r.FullName?.toLowerCase().includes(q) &&
        !r.EmployeeID.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [today, search, dept, status]);

  if (!session) return null;

  return (
    <AppShell title="Dashboard">
      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {stats ? (
          <>
            <StatCard label="Total Employees" value={stats.totalEmployees} icon={Users} />
            <StatCard label="Present Today" value={stats.presentToday} icon={UserCheck} />
            <StatCard label="Late Today" value={stats.lateToday} icon={Clock} tone="warn" />
            <StatCard label="Absent Today" value={stats.absentToday} icon={UserX} tone="danger" />
            <StatCard label="On Leave" value={stats.onLeave} icon={Palmtree} tone="gold" />
            <StatCard label="Currently Clocked In" value={stats.clockedIn} icon={LogInIcon} />
          </>
        ) : (
          Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cls.panel}>
          <div className={cls.panelTitle}>This Week&apos;s Attendance</div>
          {weekly ? <WeeklyAttendanceChart data={weekly} /> : <SkeletonChart />}
        </div>
        <div className={cls.panel}>
          <div className={cls.panelTitle}>Attendance by Department (7 days)</div>
          {byDept ? <DepartmentChart data={byDept} /> : <SkeletonChart />}
        </div>
      </div>

      <div className={cls.panel}>
        <div className={cls.panelTitle}>
          <span>Today&apos;s Attendance</span>
          <button onClick={loadStats} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
            Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2.5">
          <input
            placeholder="Search employee name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${cls.input} min-w-[160px] flex-1`}
          />
          <Select
            value={dept}
            onChange={setDept}
            className="min-w-[160px] flex-1"
            aria-label="Filter by department"
            options={[
              { value: "", label: "All Departments" },
              ...departments.map((d) => ({ value: d.DepartmentName, label: d.DepartmentName })),
            ]}
          />
          <Select
            value={status}
            onChange={setStatus}
            className="min-w-[160px] flex-1"
            aria-label="Filter by status"
            options={[
              { value: "", label: "All Statuses" },
              { value: "PRESENT", label: "Present" },
              { value: "LATE", label: "Late" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Employee</th>
                <th className={cls.th}>Department</th>
                <th className={cls.th}>Time In</th>
                <th className={cls.th}>Time Out</th>
                <th className={cls.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {!stats ? (
                <SkeletonTableRows cols={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cls.emptyState}>
                    No attendance records match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.AttendanceID} className="hover:bg-green-50/60">
                    <td className={cls.td}>
                      <div className="font-semibold">{r.FullName}</div>
                      <div className="text-[11.5px] text-gray-500">{r.EmployeeID}</div>
                    </td>
                    <td className={cls.td}>{r.Department}</td>
                    <td className={cls.td}>{r.TimeIn || "-"}</td>
                    <td className={cls.td}>{r.TimeOut || "-"}</td>
                    <td className={cls.td}>
                      <StatusBadge status={r.Status} />
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
