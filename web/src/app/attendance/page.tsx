"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { SkeletonTableRows } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cls } from "@/lib/ui";
import type { AttendanceRecord, Department } from "@/lib/types";

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call<{ attendance: AttendanceRecord[] }>("getAttendance", {
        filters: { search, department: dept, status, dateFrom, dateTo },
      });
      setRows(res.attendance);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load attendance.", true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    call<{ departments: Department[] }>("getDepartments")
      .then((res) => setDepartments(res.departments))
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) return null;

  return (
    <AppShell title="Attendance Records">
      <div className={`${cls.panel} mb-4`}>
        <div className={cls.panelTitle}>Filters</div>
        <div className="flex flex-wrap gap-2.5">
          <input
            placeholder="Search name or ID…"
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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
          <button onClick={load} className={cls.btn}>
            Apply
          </button>
        </div>
      </div>

      <div className={cls.panel}>
        <div className="mb-3.5 flex items-center justify-between">
          <div className={`${cls.panelTitle} mb-0`}>Records</div>
          <span className="text-sm text-gray-500">{rows.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                <th className={cls.th}>Date</th>
                <th className={cls.th}>Employee</th>
                <th className={cls.th}>Department</th>
                <th className={cls.th}>Time In</th>
                <th className={cls.th}>Time Out</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Late (min)</th>
                <th className={cls.th}>Total Hrs</th>
                <th className={cls.th}>OT Hrs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows cols={9} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className={cls.emptyState}>
                    No attendance records match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.AttendanceID} className="hover:bg-green-50/60">
                    <td className={cls.td}>{r.Date}</td>
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
