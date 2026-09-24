"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  LogIn,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import { addDays, formatDate, manilaToday } from "@/lib/format";
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  actionMeta,
  asObject,
  changedFields,
  displayValue,
  fieldLabel,
  splitTimestamp,
  summarize,
  type AuditCategory,
  type AuditEntry,
} from "@/components/audit/auditFormat";

const PAGE_SIZES = [25, 50, 100];
const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function userLabel(e: AuditEntry) {
  return e.UserName || e.UserID || "Unknown";
}

function CategoryBadge({ category }: { category: AuditCategory }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide uppercase ring-1 ring-inset ${CATEGORY_STYLES[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number | null; icon: typeof LogIn; tone: string }) {
  return (
    <div className={`${card} flex items-center gap-3 p-4`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={17} aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
        {value === null ? <Skeleton className="mt-1 h-5 w-10" /> : <div className="text-[20px] leading-tight font-bold text-gray-900 tabular-nums">{value}</div>}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const session = useRequireAuth(["Admin"]);
  const toast = useToast();

  const [logs, setLogs] = useState<AuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const q = useDebounced(search, 200);
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState(() => addDays(manilaToday(), -29));
  const [dateTo, setDateTo] = useState(() => manilaToday());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setError(false);
    setRefreshing(true);
    try {
      await cachedCall<{ logs: AuditEntry[]; total?: number }>("getAuditLogs", {}, (res) => {
        setLogs(res.logs);
        setTotal(res.total ?? res.logs.length);
      });
    } catch (err) {
      console.error("getAuditLogs failed", err);
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
  }, [session, load]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    const needle = q.trim().toLowerCase();
    return logs.filter((e) => {
      const day = e.Timestamp.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      const meta = actionMeta(e.Action);
      if (category && meta.category !== category) return false;
      if (!needle) return true;
      return [e.UserName, e.UserID, e.TargetName, e.Target, meta.label, e.Action, summarize(e)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [logs, q, category, dateFrom, dateTo]);

  const stats = useMemo(() => {
    if (!logs) return null;
    let signIns = 0;
    let failed = 0;
    let changes = 0;
    for (const e of filtered) {
      if (e.Action === "LOGIN") signIns++;
      else if (e.Action === "LOGIN_FAILED") failed++;
      else if (e.Action !== "TIME_IN" && e.Action !== "TIME_OUT") changes++;
    }
    return { total: filtered.length, signIns, failed, changes };
  }, [logs, filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  function resetFilters() {
    setSearch("");
    setCategory("");
    setDateFrom(addDays(manilaToday(), -29));
    setDateTo(manilaToday());
    setPage(1);
  }

  function exportCsv() {
    if (!filtered.length) return toast("There are no log entries to export.", true);
    const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      ["Date", "Time", "User", "Role", "Category", "Activity", "Target", "Details"],
      ...filtered.map((e) => {
        const ts = splitTimestamp(e.Timestamp);
        const meta = actionMeta(e.Action);
        return [ts.iso, ts.time, userLabel(e), e.UserRole, CATEGORY_LABELS[meta.category], meta.label, e.TargetName || e.Target, summarize(e)];
      }),
    ].map((r) => r.map((c) => esc(String(c ?? ""))).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!session) return null;
  const loading = logs === null;

  return (
    <AppShell title="Audit Logs">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Audit Logs</h2>
          <p className="mt-1 text-[14px] text-gray-500">A record of sign-ins, attendance, and administrative changes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={loading} className={cls.btnSecondary}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => load()} disabled={refreshing} className={cls.btn} aria-label="Refresh audit logs">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <section aria-label="Summary" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Events" value={stats?.total ?? null} icon={FileSearch} tone="bg-green-50 text-green-800" />
        <Stat label="Sign-ins" value={stats?.signIns ?? null} icon={LogIn} tone="bg-sky-50 text-sky-700" />
        <Stat label="Failed sign-ins" value={stats?.failed ?? null} icon={ShieldAlert} tone="bg-amber-50 text-amber-700" />
        <Stat label="Changes" value={stats?.changes ?? null} icon={PencilLine} tone="bg-violet-50 text-violet-700" />
      </section>

      <section aria-label="Filters" className={`${card} mb-5 p-4`}>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-[2_1_240px]">
            <label htmlFor="audit-search" className="sr-only">
              Search logs
            </label>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <input
              id="audit-search"
              type="search"
              placeholder="Search user, activity, or details"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`${cls.input} pl-9`}
            />
          </div>
          <Select
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            aria-label="Category"
            className="min-w-[160px] flex-[1_1_160px]"
            options={[{ value: "", label: "All categories" }, ...(Object.keys(CATEGORY_LABELS) as AuditCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]}
          />
          <div className="min-w-[140px] flex-[1_1_140px]">
            <label htmlFor="audit-from" className="sr-only">
              From
            </label>
            <input id="audit-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={cls.input} />
          </div>
          <div className="min-w-[140px] flex-[1_1_140px]">
            <label htmlFor="audit-to" className="sr-only">
              To
            </label>
            <input id="audit-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={cls.input} />
          </div>
          <button onClick={resetFilters} className={`${cls.btnSecondary} whitespace-nowrap`}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </section>

      <section aria-labelledby="audit-title" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
          <h3 id="audit-title" className="text-[15px] font-bold text-green-900">
            Activity
          </h3>
          {!loading && (
            <span className="text-[12.5px] text-gray-500 tabular-nums">
              {filtered.length.toLocaleString()} entr{filtered.length === 1 ? "y" : "ies"}
              {total > (logs?.length ?? 0) ? ` · showing the latest ${logs?.length.toLocaleString()}` : ""}
            </span>
          )}
        </div>

        {error && !logs ? (
          <div className="px-4 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>
            <div className="font-semibold text-gray-900">Unable to load the audit log.</div>
            <p className="mt-1 text-[13.5px] text-gray-500">Please try again.</p>
            <button onClick={() => load()} className={`${cls.btn} mt-4`}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-240px)] min-h-[200px] overflow-auto border-t border-gray-100">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                    {["Date & time", "User", "Activity", "Target", "Details"].map((h, i) => (
                      <th key={h} scope="col" className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-2.5 ${i === 0 ? "pl-5" : ""} ${i === 4 ? "pr-5" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((__, c) => (
                          <td key={c} className="border-b border-gray-100 px-3 py-3.5 first:pl-5">
                            <Skeleton className={`h-3.5 ${c === 4 ? "w-56" : "w-24"}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex flex-col items-center px-4 py-14 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                            <FileSearch size={22} />
                          </div>
                          <div className="font-semibold text-gray-900">No log entries found</div>
                          <p className="mt-1 text-[13.5px] text-gray-500">Try a different search, category, or date range.</p>
                          <button onClick={resetFilters} className={`${cls.btnSecondary} mt-4`}>
                            Clear Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => {
                      const ts = splitTimestamp(e.Timestamp);
                      const meta = actionMeta(e.Action);
                      const details = summarize(e);
                      const td = "border-b border-gray-100 px-3 py-3 align-top";
                      return (
                        <tr
                          key={e.LogID}
                          tabIndex={0}
                          onClick={() => setSelected(e)}
                          onKeyDown={(ev) => ev.key === "Enter" && setSelected(e)}
                          aria-label={`${meta.label} by ${userLabel(e)} on ${ts.date} ${ts.time}. Press Enter for details.`}
                          className="cursor-pointer transition-colors duration-150 hover:bg-green-50/50 focus-visible:bg-green-50/70 focus-visible:outline-none"
                        >
                          <td className={`${td} pl-5 whitespace-nowrap`}>
                            <div className="font-medium text-gray-900">{ts.date}</div>
                            <div className="text-[12px] text-gray-500 tabular-nums">{ts.time}</div>
                          </td>
                          <td className={`${td} max-w-[220px]`}>
                            <div className="truncate font-semibold text-gray-900">{userLabel(e)}</div>
                            <div className="truncate text-[12px] text-gray-500">{e.UserName ? e.UserRole || e.UserID : e.UserID.includes("@") ? "Not a registered user" : ""}</div>
                          </td>
                          <td className={`${td} whitespace-nowrap`}>
                            <div className="font-medium text-gray-900">{meta.label}</div>
                            <div className="mt-1">
                              <CategoryBadge category={meta.category} />
                            </div>
                          </td>
                          <td className={`${td} max-w-[200px]`}>
                            <div className="truncate text-gray-800">{e.TargetName || (e.Target && e.Target !== e.UserID ? e.Target : "") || "—"}</div>
                            {e.TargetName && e.Target && <div className="truncate text-[12px] text-gray-500">{e.Target}</div>}
                          </td>
                          <td className={`${td} pr-5 text-gray-600`}>
                            <div className="line-clamp-2 max-w-[440px]">{details || <span className="text-gray-400">—</span>}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3 text-[13px] text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">
                    Showing {((current - 1) * pageSize + 1).toLocaleString()}–{Math.min(current * pageSize, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
                  </span>
                  <label className="flex items-center gap-1.5">
                    <span className="hidden sm:inline">Rows per page</span>
                    <select
                      value={pageSize}
                      onChange={(ev) => {
                        setPageSize(Number(ev.target.value));
                        setPage(1);
                      }}
                      aria-label="Rows per page"
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
                <nav aria-label="Pagination" className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(current - 1)}
                    disabled={current === 1}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span className="px-2 tabular-nums">
                    Page {current} of {pageCount}
                  </span>
                  <button
                    onClick={() => setPage(current + 1)}
                    disabled={current === pageCount}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </section>

      <AuditDetail entry={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}

function AuditDetail({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const e = entry;
  const meta = e ? actionMeta(e.Action) : null;
  const ts = e ? splitTimestamp(e.Timestamp) : null;
  const o = e ? asObject(e.OldValue) : {};
  const n = e ? asObject(e.NewValue) : {};
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter((k) => k !== "Reason");
  const changed = new Set(e ? changedFields(e).map((c) => c.key) : []);
  const hasBefore = Object.keys(o).length > 0;
  const plainOld = e && typeof e.OldValue === "string" ? e.OldValue : "";
  const plainNew = e && typeof e.NewValue === "string" ? e.NewValue : "";

  return (
    <Dialog.Root open={!!e} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[180] bg-black/35 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[190] flex w-full max-w-[480px] flex-col bg-white shadow-2xl focus:outline-none data-[state=open]:animate-[drawer-in_200ms_ease-out]"
        >
          {e && meta && ts && (
            <>
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <Dialog.Title className="text-[17px] font-bold text-green-900">{meta.label}</Dialog.Title>
                  <div className="mt-1 flex items-center gap-2 text-[12.5px] text-gray-500">
                    <CategoryBadge category={meta.category} />
                    {ts.date}, {ts.time}
                  </div>
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
                >
                  <X size={18} />
                </Dialog.Close>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Performed by</dt>
                    <dd className="mt-0.5 font-medium text-gray-900">{userLabel(e)}</dd>
                    <dd className="text-[12px] break-all text-gray-500">{[e.UserRole, e.UserName ? e.UserID : ""].filter(Boolean).join(" · ")}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Target</dt>
                    <dd className="mt-0.5 font-medium text-gray-900">{e.TargetName || e.Target || "—"}</dd>
                    {e.TargetName && <dd className="text-[12px] break-all text-gray-500">{e.Target}</dd>}
                  </div>
                </dl>

                {summarize(e) && (
                  <div className="rounded-lg bg-gray-50 px-3.5 py-3 text-[13.5px] text-gray-800">{summarize(e)}</div>
                )}

                {typeof n.Reason === "string" && n.Reason && (
                  <div>
                    <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Reason</div>
                    <p className="mt-1 text-[13.5px] text-gray-900">{n.Reason}</p>
                  </div>
                )}

                {keys.length > 0 && (
                  <div>
                    <div className="mb-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                      {hasBefore ? "Changes" : "Recorded values"}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full text-[12.5px]">
                        <thead className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            {hasBefore && <th className="px-3 py-2">Before</th>}
                            <th className="px-3 py-2">{hasBefore ? "After" : "Value"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keys.map((k) => {
                            const isChanged = hasBefore && changed.has(k);
                            return (
                              <tr key={k} className={`border-t border-gray-100 ${isChanged ? "bg-amber-50/50" : ""}`}>
                                <td className="px-3 py-2 font-medium whitespace-nowrap text-gray-700">{fieldLabel(k)}</td>
                                {hasBefore && <td className="px-3 py-2 break-words text-gray-500">{displayValue(o[k])}</td>}
                                <td className={`px-3 py-2 break-words ${isChanged ? "font-medium text-gray-900" : "text-gray-700"}`}>
                                  {k in n ? displayValue(n[k]) : hasBefore ? <span className="text-gray-400">unchanged</span> : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!keys.length && (plainOld || plainNew) && (
                  <dl className="grid grid-cols-2 gap-4 text-[13.5px]">
                    <div>
                      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">Before</dt>
                      <dd className="mt-0.5 break-words text-gray-700">{displayValue(plainOld)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">After</dt>
                      <dd className="mt-0.5 break-words text-gray-900">{displayValue(plainNew)}</dd>
                    </div>
                  </dl>
                )}

                <p className="text-[11.5px] text-gray-400">
                  Entry {e.LogID}. Passwords and QR codes are never recorded in the audit log. Times are Philippine Standard Time
                  {ts.iso ? ` (${formatDate(ts.iso, "long")})` : ""}.
                </p>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
