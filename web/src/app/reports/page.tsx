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
import type { Department, Employee } from "@/lib/types";

type ReportRow = Record<string, string | number | undefined>;

const REPORT_TITLES: Record<string, string> = {
  daily: "Daily DTR",
  monthly: "Monthly DTR",
  employee: "Employee DTR",
  department: "Department Attendance",
  late: "Late Employees",
  absences: "Absences",
  overtime: "Overtime",
};

const COLUMN_SETS: Record<string, string[]> = {
  default: ["Date", "FullName", "EmployeeID", "Department", "TimeIn", "TimeOut", "Status", "LateMinutes", "TotalHours", "OvertimeHours"],
  department: ["Department", "Present", "Late", "TotalHours"],
  absences: ["Date", "FullName", "EmployeeID", "Department"],
};

const COLUMN_LABELS: Record<string, string> = {
  FullName: "Employee",
  EmployeeID: "ID",
  TimeIn: "Time In",
  TimeOut: "Time Out",
  LateMinutes: "Late (min)",
  TotalHours: "Total Hrs",
  OvertimeHours: "OT Hrs",
};

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();

  const [type, setType] = useState("daily");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dept, setDept] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const filters = { dateFrom, dateTo, department: dept, employeeId };

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await call<{ rows: ReportRow[] }>("getReport", { type, filters });
      setRows(res.rows);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load report.", true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dept, employeeId, dateFrom, dateTo]);

  useEffect(() => {
    if (!session) return;
    call<{ departments: Department[] }>("getDepartments").then((r) => setDepartments(r.departments)).catch(() => {});
    call<{ employees: Employee[] }>("getEmployees").then((r) => setEmployees(r.employees)).catch(() => {});
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function exportCsv() {
    try {
      const res = await call<{ csv: string; filename: string }>("exportReportCsv", { type, filters });
      if (!res.csv) {
        toast("Nothing to export.", true);
        return;
      }
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(res.csv);
      a.download = res.filename;
      a.click();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed.", true);
    }
  }

  if (!session) return null;
  const cols = COLUMN_SETS[type] ?? COLUMN_SETS.default;

  return (
    <AppShell title="Reports">
      <div className={`${cls.panel} no-print mb-4`}>
        <div className={cls.panelTitle}>Report Filters</div>
        <div className="flex flex-wrap gap-2.5">
          <Select
            value={type}
            onChange={setType}
            className="min-w-[160px] flex-1"
            aria-label="Report type"
            options={Object.entries(REPORT_TITLES).map(([key, label]) => ({ value: key, label }))}
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${cls.input} min-w-[160px] flex-1`} />
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
            value={employeeId}
            onChange={setEmployeeId}
            className="min-w-[160px] flex-1"
            aria-label="Filter by employee"
            options={[
              { value: "", label: "All Employees" },
              ...employees.map((e) => ({ value: e.EmployeeID, label: `${e.FullName} (${e.EmployeeID})` })),
            ]}
          />
          <button onClick={runReport} className={cls.btn}>
            Run Report
          </button>
          <button onClick={exportCsv} className={cls.btnSecondary}>
            Export CSV
          </button>
          <button onClick={() => window.print()} className={cls.btnSecondary}>
            Print Report
          </button>
        </div>
      </div>

      <div className={cls.panel}>
        <div className="mb-3.5 flex items-center justify-between">
          <div className={`${cls.panelTitle} mb-0`}>{REPORT_TITLES[type]}</div>
          <span className="text-sm text-gray-500">{rows.length} row(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} className={cls.th}>
                    {COLUMN_LABELS[c] ?? c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows cols={cols.length} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className={cls.emptyState}>
                    No data for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="hover:bg-green-50/60">
                    {cols.map((c) => (
                      <td key={c} className={cls.td}>
                        {c === "Status" ? (
                          <StatusBadge status={String(r[c] ?? "")} />
                        ) : (
                          String(r[c] ?? "-")
                        )}
                      </td>
                    ))}
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
