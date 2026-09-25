"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarSearch,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Info,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { KpiCards, type KpiValues } from "@/components/attendance/KpiCards";
import { AttendanceDetail } from "@/components/attendance/AttendanceDetail";
import { EditAttendanceDialog, type EditMode } from "@/components/attendance/EditAttendanceDialog";
import { exportCsv, exportXlsx, printReport, type ReportMeta } from "@/components/attendance/exporters";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { attendanceDefaultFilters } from "@/lib/prefetch";
import { cls } from "@/lib/ui";
import { formatDate, formatHours, formatTime, manilaToday, toNumber, weekdayShort } from "@/lib/format";
import type { AttendanceRecord, AttendanceResponse, AttendanceSchedule, Department } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "ON LEAVE", label: "On Leave" },
  { value: "HOLIDAY", label: "Holiday" },
  { value: "DAY OFF", label: "Day Off" },
  { value: "OFFICIAL BUSINESS", label: "Official Business" },
];

const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = "date" | "employee" | "department" | "timeIn" | "timeOut" | "status" | "late" | "hours" | "ot";
type SortDir = "asc" | "desc";

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "date", label: "Date" },
  { key: "employee", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "timeIn", label: "Time In" },
  { key: "timeOut", label: "Time Out" },
  { key: "status", label: "Status" },
  { key: "late", label: "Late", align: "right" },
  { key: "hours", label: "Work Hours", align: "right" },
  { key: "ot", label: "OT Hours", align: "right" },
];

interface AppliedFilters {
  dateFrom: string;
  dateTo: string;
  department: string;
}

function defaultFilters(): AppliedFilters {
  return attendanceDefaultFilters();
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function sortValue(r: AttendanceRecord, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.Date;
    case "employee":
      return (r.FullName ?? "").toLowerCase();
    case "department":
      return (r.Department ?? "").toLowerCase();
    case "timeIn":
      return r.TimeIn24 || "";
    case "timeOut":
      return r.TimeOut24 || "";
    case "status":
      return r.Status;
    case "late":
      return toNumber(r.LateMinutes) ?? -1;
    case "hours":
      return toNumber(r.TotalHours) ?? -1;
    case "ot":
      return toNumber(r.OvertimeHours) ?? -1;
  }
}

function isAttended(status: string) {
  // Official business is work done outside the office, so it counts as present.
  return status === "PRESENT" || status === "LATE" || status === "INCOMPLETE" || status === "OFFICIAL BUSINESS";
}

function pageList(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const menuItemCls =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-gray-700 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-green-50 data-[highlighted]:text-green-900";
const menuContentCls = "z-[150] min-w-[200px] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg";

export default function AttendancePage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const confirm = useConfirm();

  // Data
  const [rows, setRows] = useState<AttendanceRecord[] | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [schedule, setSchedule] = useState<AttendanceSchedule | null>(null);
  const [derivedSkipped, setDerivedSkipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgName, setOrgName] = useState("");

  // Filters: date range + department are fetched from the server on Apply;
  // search + status filter the loaded rows instantly.
  const [draft, setDraft] = useState<AppliedFilters>(defaultFilters);
  const [applied, setApplied] = useState<AppliedFilters>(defaultFilters);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [rangeError, setRangeError] = useState("");

  // Table
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Panels
  const [detail, setDetail] = useState<AttendanceRecord | null>(null);
  const [editing, setEditing] = useState<{ record: AttendanceRecord; mode: EditMode } | null>(null);

  const role = session?.user.role;
  const canEdit = role === "Admin" || role === "HR";
  const canDelete = role === "Admin";

  // Only sets state after the request settles, so it's safe to start from an effect.
  const fetchAttendance = useCallback(async (filters: AppliedFilters) => {
    try {
      await cachedCall<AttendanceResponse>("getAttendance", { filters }, (res) => {
        setRows(res.attendance);
        setEmployeeCount(res.employeeCount ?? 0);
        setSchedule(res.schedule ?? null);
        setDerivedSkipped(!!res.derivedSkipped);
        setLoadError(false);
        // Cached rows can be shown right away; skeletons are only for a cold load.
        setLoading(false);
      });
    } catch (err) {
      console.error("getAttendance failed", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(
    (filters: AppliedFilters) => {
      setLoading(true);
      setLoadError(false);
      return fetchAttendance(filters);
    },
    [fetchAttendance]
  );

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    fetchAttendance(applied);
    cachedCall<{ departments: Department[] }>("getDepartments", {}, (res) =>
      setDepartments(res.departments.filter((d) => d.Status !== "Inactive"))
    ).catch((err) => console.error("getDepartments failed", err));
    cachedCall<{ settings: Record<string, string> }>("getSettings", {}, (res) => setOrgName(res.settings.ORG_NAME ?? "")).catch(() => {});
    // Initial load only; later loads come from Apply / Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function applyFilters() {
    if (!draft.dateFrom || !draft.dateTo) {
      setRangeError("Please choose both a start and end date.");
      return;
    }
    if (draft.dateFrom > draft.dateTo) {
      setRangeError("Start date must be on or before the end date.");
      return;
    }
    setRangeError("");
    setApplied(draft);
    setPage(1);
    load(draft);
  }

  function resetFilters() {
    const d = defaultFilters();
    setDraft(d);
    setApplied(d);
    setSearch("");
    setStatus("");
    setRangeError("");
    setPage(1);
    load(d);
  }

  // Rows matching search (before status), used for KPIs so the cards don't
  // all drop to zero when a status filter is picked.
  const searched = useMemo(() => {
    if (!rows) return [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.FullName ?? "").toLowerCase().includes(q) || r.EmployeeID.toLowerCase().includes(q));
  }, [rows, debouncedSearch]);

  const filtered = useMemo(() => (status ? searched.filter((r) => r.Status === status) : searched), [searched, status]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      // Stable secondary order: newest date first, then name.
      return b.Date.localeCompare(a.Date) || (a.FullName ?? "").localeCompare(b.FullName ?? "");
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const kpis: KpiValues | null = useMemo(() => {
    if (!rows) return null;
    let attended = 0;
    let late = 0;
    let absent = 0;
    let overtime = 0;
    for (const r of searched) {
      if (isAttended(r.Status)) attended++;
      if (r.Status === "LATE") late++;
      if (r.Status === "ABSENT") absent++;
      overtime += toNumber(r.OvertimeHours) ?? 0;
    }
    return {
      totalEmployees: employeeCount,
      attended,
      late,
      absent,
      overtimeHours: Math.round(overtime * 100) / 100,
      attendanceRate: attended + absent > 0 ? attended / (attended + absent) : null,
    };
  }, [rows, searched, employeeCount]);

  const today = manilaToday();
  const periodLabel =
    applied.dateFrom === applied.dateTo
      ? applied.dateFrom === today
        ? "Today"
        : formatDate(applied.dateFrom)
      : "Selected period";

  const hasActiveFilters =
    !!search || !!status || applied.department !== "" || JSON.stringify(applied) !== JSON.stringify(defaultFilters());

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "desc" : "asc" }));
    setPage(1);
  }

  function reportMeta(): ReportMeta {
    return { orgName, ...applied, status, search: debouncedSearch.trim() };
  }

  async function handleExport(kind: "csv" | "xlsx" | "print") {
    if (!sorted.length && kind !== "print") {
      toast("There are no records to export for the current filters.", true);
      return;
    }
    try {
      if (kind === "csv") exportCsv(sorted, reportMeta());
      if (kind === "xlsx") await exportXlsx(sorted, reportMeta());
      if (kind === "print" && !printReport(sorted, reportMeta())) {
        toast("Please allow pop-ups for this site to print the report.", true);
      }
    } catch (err) {
      console.error("export failed", err);
      toast("Unable to create the export. Please try again.", true);
    }
  }

  function handleSaved(previousId: string, saved: AttendanceRecord) {
    setRows((prev) => (prev ? prev.map((r) => (r.AttendanceID === previousId ? saved : r)) : prev));
    setDetail((d) => (d && d.AttendanceID === previousId ? saved : d));
    setEditing(null);
    toast("Attendance record saved.");
  }

  async function handleDelete(r: AttendanceRecord) {
    const ok = await confirm({
      title: "Delete Attendance Record?",
      message: `${r.FullName} · ${formatDate(r.Date, "long")}. This action cannot be undone.`,
      confirmLabel: "Delete Record",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await call("deleteAttendance", { attendanceId: r.AttendanceID });
      toast("Attendance record deleted.");
      setDetail(null);
      // Reload so the day reappears as ABSENT where appropriate.
      load(applied);
    } catch (err) {
      console.error("deleteAttendance failed", err);
      toast(err instanceof Error ? err.message : "Unable to delete the record. Please try again.", true);
    }
  }

  if (!session) return null;

  const firstShown = sorted.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastShown = Math.min(currentPage * pageSize, sorted.length);

  return (
    <AppShell title="Attendance Records">
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Attendance Management</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-gray-500">
            Track employee time-in, time-out, attendance status, working hours, and overtime.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={cls.btnSecondary} disabled={loading || loadError}>
              <Download size={15} /> Export <ChevronDown size={14} className="text-gray-400" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className={menuContentCls}>
                <DropdownMenu.Item className={menuItemCls} onSelect={() => handleExport("csv")}>
                  <FileText size={16} className="text-gray-400" /> Export CSV
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItemCls} onSelect={() => handleExport("xlsx")}>
                  <FileSpreadsheet size={16} className="text-gray-400" /> Export Excel
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                <DropdownMenu.Item className={menuItemCls} onSelect={() => handleExport("print")}>
                  <Printer size={16} className="text-gray-400" /> Print Report
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button onClick={() => load(applied)} disabled={loading} className={cls.btn} aria-label="Refresh attendance data">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="Attendance summary" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-5">
        <KpiCards values={loading && !rows ? null : kpis} periodLabel={periodLabel} />
      </section>

      {/* Filters */}
      <section aria-labelledby="filters-title" className="mb-5 rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,16,0.04)] sm:p-5">
        <h3 id="filters-title" className="mb-3 text-[15px] font-bold text-green-900">
          Attendance Filters
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="flex flex-wrap gap-3"
        >
          <div className="relative min-w-[200px] flex-[2_1_200px]">
            <label htmlFor="att-search" className="sr-only">
              Search employee name or ID
            </label>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <input
              id="att-search"
              type="search"
              placeholder="Search employee name or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`${cls.input} pl-9`}
            />
          </div>
          <Select
            value={draft.department}
            onChange={(v) => setDraft((d) => ({ ...d, department: v }))}
            aria-label="Department"
            className="min-w-[150px] flex-[1_1_150px]"
            options={[{ value: "", label: "All Departments" }, ...departments.map((d) => ({ value: d.DepartmentName, label: d.DepartmentName }))]}
          />
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            aria-label="Status"
            className="min-w-[140px] flex-[1_1_140px]"
            options={STATUS_OPTIONS}
          />
          <div className="min-w-[140px] flex-[1_1_140px]">
            <label htmlFor="att-from" className="sr-only">
              Start date
            </label>
            <input
              id="att-from"
              type="date"
              value={draft.dateFrom}
              max={draft.dateTo || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              className={cls.input}
              aria-invalid={!!rangeError}
            />
          </div>
          <div className="min-w-[140px] flex-[1_1_140px]">
            <label htmlFor="att-to" className="sr-only">
              End date
            </label>
            <input
              id="att-to"
              type="date"
              value={draft.dateTo}
              min={draft.dateFrom || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              className={cls.input}
              aria-invalid={!!rangeError}
            />
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:flex-none">
            <button type="submit" className={`${cls.btn} flex-1 whitespace-nowrap sm:flex-none`} disabled={loading}>
              Apply Filters
            </button>
            <button type="button" onClick={resetFilters} className={`${cls.btnSecondary} whitespace-nowrap`} aria-label="Reset filters">
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </form>
        {rangeError && (
          <p role="alert" className="mt-2.5 flex items-center gap-1.5 text-[13px] text-red-600">
            <AlertTriangle size={14} /> {rangeError}
          </p>
        )}
      </section>

      {/* Records */}
      <section aria-labelledby="records-title" className="rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3 sm:px-5">
          <h3 id="records-title" className="text-[15px] font-bold text-green-900">
            Attendance Records
          </h3>
          {!loading && !loadError && (
            <span className="text-[13px] text-gray-500 tabular-nums">
              {sorted.length.toLocaleString()} record{sorted.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {derivedSkipped && !loadError && (
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[12.5px] text-sky-900 sm:mx-5">
            <Info size={15} className="mt-px shrink-0" />
            Absent, leave, and holiday days are listed for date ranges of up to 93 days. Narrow the range to include them.
          </div>
        )}

        {loadError ? (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <div className="font-semibold text-gray-900">Unable to load attendance records.</div>
            <p className="mt-1 text-[13.5px] text-gray-500">Please try again.</p>
            <button onClick={() => load(applied)} className={`${cls.btn} mt-4`}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-220px)] min-h-[200px] overflow-auto border-t border-gray-100">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => {
                      const active = sort.key === c.key;
                      const SortIcon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                      return (
                        <th
                          key={c.key}
                          scope="col"
                          aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                          className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-bold tracking-wide whitespace-nowrap text-gray-500 uppercase first:pl-5 ${
                            c.align === "right" ? "text-right" : "text-left"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className={`inline-flex items-center gap-1 rounded uppercase transition-colors hover:text-green-900 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none ${
                              active ? "text-green-900" : ""
                            }`}
                          >
                            {c.label}
                            <SortIcon size={12} className={active ? "" : "opacity-40"} aria-hidden />
                          </button>
                        </th>
                      );
                    })}
                    <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-2.5 pr-5 text-right text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                      <span className="sr-only">Actions</span>
                      <span aria-hidden>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: COLUMNS.length + 1 }).map((__, c) => (
                          <td key={c} className="border-b border-gray-100 px-3 py-3.5 first:pl-5">
                            <Skeleton className={`h-3.5 ${c === 1 ? "w-36" : "w-16"}`} />
                            {c === 1 && <Skeleton className="mt-1.5 h-2.5 w-24" />}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1}>
                        <div className="flex flex-col items-center px-4 py-14 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                            <CalendarSearch size={22} />
                          </div>
                          <div className="font-semibold text-gray-900">No attendance records found</div>
                          <p className="mt-1 text-[13.5px] text-gray-500">Try changing your filters or date range.</p>
                          {hasActiveFilters && (
                            <button onClick={resetFilters} className={`${cls.btnSecondary} mt-4`}>
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <AttendanceRow
                        key={r.AttendanceID}
                        r={r}
                        today={today}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onOpen={() => setDetail(r)}
                        onEdit={(mode) => setEditing({ record: r, mode })}
                        onDelete={() => handleDelete(r)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && sorted.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-[13px] text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    Showing {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {sorted.length.toLocaleString()} records
                  </span>
                  <label className="flex items-center gap-1.5">
                    <span className="hidden sm:inline">Rows per page</span>
                    <span className="sr-only sm:hidden">Rows per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[13px] focus:border-green-600 focus:ring-2 focus:ring-green-100 focus:outline-none"
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} /> <span className="hidden sm:inline">Previous</span>
                  </button>
                  {pageList(currentPage, pageCount).map((p, i) =>
                    p === "…" ? (
                      <span key={`gap-${i}`} className="px-1.5 text-gray-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        aria-current={p === currentPage ? "page" : undefined}
                        aria-label={`Page ${p}`}
                        className={`h-8 min-w-8 rounded-md px-2 font-medium tabular-nums transition-colors ${
                          p === currentPage ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === pageCount}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="hidden sm:inline">Next</span> <ChevronRight size={15} />
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </section>

      <AttendanceDetail
        record={detail}
        schedule={schedule}
        canEdit={canEdit}
        onClose={() => setDetail(null)}
        onEdit={(r) => setEditing({ record: r, mode: "edit" })}
      />
      <EditAttendanceDialog target={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
    </AppShell>
  );
}

function AttendanceRow({
  r,
  today,
  canEdit,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
}: {
  r: AttendanceRecord;
  today: string;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: (mode: EditMode) => void;
  onDelete: () => void;
}) {
  const late = toNumber(r.LateMinutes);
  const inProgress = !!r.TimeIn && !r.TimeOut && r.Date === today && r.Status !== "INCOMPLETE";
  const td = "border-b border-gray-100 px-3 py-3 whitespace-nowrap first:pl-5";

  return (
    <tr
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      aria-label={`${r.FullName}, ${formatDate(r.Date, "long")}, ${r.Status}. Press Enter for details.`}
      className="cursor-pointer transition-colors duration-150 hover:bg-green-50/50 focus-visible:bg-green-50/70 focus-visible:outline-none"
    >
      <td className={td}>
        <div className="font-medium text-gray-900">{formatDate(r.Date)}</div>
        <div className="text-[11.5px] text-gray-400">{weekdayShort(r.Date)}</div>
      </td>
      <td className={`${td} max-w-[260px]`}>
        <div className="truncate font-semibold text-gray-900">{r.FullName || "Unknown"}</div>
        <div className="truncate text-[11.5px] text-gray-500">{r.EmployeeID}</div>
      </td>
      <td className={`${td} max-w-[200px] truncate text-gray-700`}>{r.Department || "—"}</td>
      <td className={`${td} tabular-nums text-gray-900`}>{formatTime(r.TimeIn) || <span className="text-gray-400">—</span>}</td>
      <td className={`${td} tabular-nums text-gray-900`}>
        {r.TimeOut ? (
          formatTime(r.TimeOut)
        ) : inProgress ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-sky-700">
            <Clock3 size={12} /> IN PROGRESS
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className={td}>
        <StatusBadge status={r.Status} />
      </td>
      <td className={`${td} text-right tabular-nums`}>
        {late === null ? (
          <span className="text-gray-400">—</span>
        ) : late > 0 ? (
          <span className="font-medium text-amber-700">{late} min</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
      <td className={`${td} text-right tabular-nums text-gray-900`}>
        {toNumber(r.TotalHours) === null ? <span className="text-gray-400">—</span> : formatHours(r.TotalHours)}
      </td>
      <td className={`${td} text-right tabular-nums`}>
        {toNumber(r.OvertimeHours) ? (
          <span className="font-medium text-indigo-700">{formatHours(r.OvertimeHours)}</span>
        ) : toNumber(r.OvertimeHours) === 0 ? (
          <span className="text-gray-400">0.00</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className={`${td} pr-5 text-right`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`Actions for ${r.FullName} on ${formatDate(r.Date, "long")}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none data-[state=open]:bg-gray-100"
          >
            <MoreHorizontal size={17} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className={menuContentCls}>
              <DropdownMenu.Item className={menuItemCls} onSelect={onOpen}>
                <Eye size={16} className="text-gray-400" /> View Details
              </DropdownMenu.Item>
              {canEdit && (
                <>
                  <DropdownMenu.Item className={menuItemCls} onSelect={() => onEdit("edit")}>
                    <Pencil size={16} className="text-gray-400" /> {r.Derived ? "Add Attendance" : "Edit Attendance"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemCls} disabled={r.Derived} onSelect={() => onEdit("timeIn")}>
                    <LogIn size={16} className="text-gray-400" /> Correct Time In
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className={menuItemCls} disabled={r.Derived} onSelect={() => onEdit("timeOut")}>
                    <LogOut size={16} className="text-gray-400" /> Correct Time Out
                  </DropdownMenu.Item>
                </>
              )}
              <DropdownMenu.Item asChild className={menuItemCls}>
                <Link href={`/employees?q=${encodeURIComponent(r.EmployeeID)}`}>
                  <UserRound size={16} className="text-gray-400" /> View Employee
                </Link>
              </DropdownMenu.Item>
              {canDelete && !r.Derived && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
                  <DropdownMenu.Item
                    className={`${menuItemCls} text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700`}
                    onSelect={onDelete}
                  >
                    <Trash2 size={16} /> Delete Record
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </td>
    </tr>
  );
}
