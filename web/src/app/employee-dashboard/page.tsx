"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  IdCard,
  Info,
  Loader2,
  LogIn,
  LogOut,
  Megaphone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/Badge";
import { Skeleton } from "@/components/Skeleton";
import { AttendanceCalendar } from "@/components/employee/AttendanceCalendar";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { cls } from "@/lib/ui";
import { PH_TIMEZONE, formatDate, formatHours, formatTime, toNumber } from "@/lib/format";
import type { AttendanceRecord, EmployeeDashboard, ScanResult } from "@/lib/types";

type DayState = "none" | "working" | "completed" | "holiday" | "leave";

const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";
const cardTitle = "text-[15px] font-bold text-green-900";

/** Wall-clock ms for a "yyyy-MM-dd" + "HH:mm" in Manila, or null. */
function manilaMs(date: string, hhmm: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":");
  const ms = Date.parse(`${date}T${h.padStart(2, "0")}:${m}:00+08:00`);
  return Number.isFinite(ms) ? ms : null;
}

function duration(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** Ticks every second. offsetMs corrects a device clock that's clearly wrong. */
function useNow(offsetMs: number) {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offsetMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
}

const manilaParts = (ms: number) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: PH_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(ms);
const manilaHour = (ms: number) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: PH_TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(ms));

function Kpi({ label, value, sub, loading }: { label: string; value: React.ReactNode; sub?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-3">
      <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-5 w-20" />
      ) : (
        <div className="mt-1 truncate text-[17px] font-bold text-gray-900 tabular-nums">{value}</div>
      )}
      {!loading && sub && <div className="mt-0.5 truncate text-[12px] text-gray-500">{sub}</div>}
    </div>
  );
}

export default function EmployeeDashboardPage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState<EmployeeDashboard | null>(null);
  const [error, setError] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [acting, setActing] = useState<"in" | "out" | null>(null);
  const now = useNow(offsetMs);

  const load = useCallback(async () => {
    setError(false);
    try {
      await cachedCall<EmployeeDashboard>("getEmployeeDashboard", {}, (res, fromCache) => {
        setData(res);
        // Only correct the clock from a fresh response, and only when the
        // device is clearly off (small differences are just network delay).
        if (!fromCache && typeof res.serverNowMs === "number") {
          const diff = res.serverNowMs - Date.now();
          setOffsetMs(Math.abs(diff) > 60_000 ? diff : 0);
        }
      });
    } catch (err) {
      console.error("Unable to load dashboard", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
  }, [session, load]);

  const today = data?.today ?? null;
  const state: DayState = today?.TimeIn
    ? today.TimeOut
      ? "completed"
      : "working"
    : data?.todayHoliday
      ? "holiday"
      : data?.todayLeave
        ? "leave"
        : "none";

  async function clock(kind: "in" | "out") {
    if (acting) return;
    const ok = await confirm({
      title: kind === "in" ? "Time in now?" : "Time out now?",
      message:
        kind === "in"
          ? "Your time in will be recorded with the current Philippine time."
          : "This ends your workday. You won't be able to time out again today.",
      confirmLabel: kind === "in" ? "Time In" : "Time Out",
    });
    if (!ok) return;
    setActing(kind);
    try {
      const res = await call<ScanResult>("manualTimeAction", { device: "Web" });
      const at = formatTime(res.action === "TIME_IN" ? res.record.TimeIn : res.record.TimeOut);
      toast(`${res.action === "TIME_IN" ? "Time In" : "Time Out"} recorded at ${at}.`);
      // Show it immediately; the reload below fills in the rest.
      setData((d) =>
        d
          ? {
              ...d,
              today: { ...(d.today ?? ({} as AttendanceRecord)), ...res.record },
              todayTimeInMs: res.action === "TIME_IN" ? Date.now() + offsetMs : d.todayTimeInMs,
            }
          : d
      );
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to record your attendance. Please try again.", true);
      load();
    } finally {
      setActing(null);
    }
  }

  // Monthly summary from the calendar's real day statuses.
  const month = useMemo(() => {
    const days = data?.month.days ?? [];
    let attended = 0;
    let late = 0;
    let absent = 0;
    let hours = 0;
    for (const d of days) {
      if (d.status === "PRESENT" || d.status === "LATE" || d.status === "INCOMPLETE") attended++;
      if (d.status === "LATE") late++;
      if (d.status === "ABSENT") absent++;
      hours += toNumber(d.totalHours) ?? 0;
    }
    const rate = attended + absent > 0 ? attended / (attended + absent) : null;
    return { attended, late, absent, hours: Math.round(hours * 10) / 10, rate };
  }, [data]);

  // Work progress while timed in today.
  const progress = useMemo(() => {
    if (!data || state !== "working" || !data.todayTimeInMs) return null;
    const start = manilaMs(data.todayDate, data.schedule.start);
    const end = manilaMs(data.todayDate, data.schedule.end);
    if (start === null || end === null || end <= start) return null;
    const timeIn = data.todayTimeInMs;
    let worked = now - timeIn;
    const ls = manilaMs(data.todayDate, data.schedule.lunchStart);
    const le = manilaMs(data.todayDate, data.schedule.lunchEnd);
    if (ls !== null && le !== null && le > ls) worked -= Math.max(0, Math.min(now, le) - Math.max(timeIn, ls));
    const lo = Math.min(start, timeIn);
    const hi = Math.max(end, now);
    const pct = (t: number) => Math.min(100, Math.max(0, ((t - lo) / (hi - lo)) * 100));
    return {
      worked: Math.max(0, worked),
      remaining: Math.max(0, end - now),
      pastEnd: now > end,
      inPct: pct(timeIn),
      nowPct: pct(now),
      startPct: pct(start),
      endPct: pct(end),
    };
  }, [data, state, now]);

  if (!session) return null;

  const firstName = (data?.employee.FullName ?? session.user.fullName).split(" ")[0];
  const loading = !data;
  const lateToday = today && Number(today.LateMinutes) > 0 && state !== "holiday" && state !== "leave";

  const stateInfo: Record<DayState, { label: string; message: string }> = {
    none: { label: "Not Timed In", message: "Your attendance for today has not been recorded." },
    working: { label: "Working", message: "Your workday is currently in progress." },
    completed: { label: "Completed", message: "Your attendance for today is complete." },
    holiday: { label: "Holiday", message: `Today is a holiday${data?.todayHoliday ? `: ${data.todayHoliday}` : ""}.` },
    leave: { label: "On Leave", message: `You're on approved ${data?.todayLeave ? `${data.todayLeave.toLowerCase()} ` : ""}leave today.` },
  };

  const canTimeIn = !loading && !today?.TimeIn;
  const canTimeOut = !loading && !!today?.TimeIn && !today?.TimeOut;

  return (
    <AppShell title="Dashboard">
      <div className="mb-5">
        <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Dashboard</h2>
        <p className="mt-1 text-[14px] text-gray-500">Welcome back, {firstName}. Here&apos;s your attendance overview.</p>
      </div>

      {error && !data ? (
        <div className={`${card} px-4 py-14 text-center`}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={22} />
          </div>
          <div className="font-semibold text-gray-900">Unable to load attendance data.</div>
          <p className="mt-1 text-[13.5px] text-gray-500">Please check your connection and try again.</p>
          <button onClick={() => load()} className={`${cls.btn} mt-4`}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Today */}
          <section aria-labelledby="today-title" className={`${card} p-5`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 id="today-title" className="text-[19px] font-bold text-green-950">
                  {greeting(manilaHour(now))}, {firstName}!
                </h3>
                <div className="text-[13.5px] text-gray-500">{data ? formatDate(data.todayDate, "long") : <Skeleton className="mt-1 h-3.5 w-36" />}</div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {loading ? (
                    <Skeleton className="h-5 w-64" />
                  ) : (
                    <>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[13.5px] ${
                          state === "completed" ? "text-green-800" : state === "working" ? "text-sky-800" : "text-gray-700"
                        }`}
                      >
                        {state === "completed" ? <CheckCircle2 size={16} /> : state === "working" ? <Clock3 size={16} /> : <Info size={16} />}
                        {stateInfo[state].message}
                      </span>
                      {lateToday && <StatusBadge status="LATE" />}
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-green-100 bg-green-50/60 px-4 py-2.5 sm:text-right">
                <div className="text-[11px] font-semibold tracking-wide text-green-800/80 uppercase">Current Time</div>
                <div className="text-[24px] leading-tight font-bold text-green-950 tabular-nums" aria-live="off">
                  {manilaParts(now)}
                </div>
                <div className="text-[11.5px] text-gray-500">Philippine Standard Time</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Kpi
                label="Today's Status"
                loading={loading}
                value={stateInfo[state].label}
                sub={
                  state === "working" || state === "completed"
                    ? lateToday
                      ? `Late · ${today?.LateMinutes} min`
                      : "On time"
                    : undefined
                }
              />
              <Kpi label="Time In" loading={loading} value={formatTime(today?.TimeIn) || "—"} />
              <Kpi label="Time Out" loading={loading} value={formatTime(today?.TimeOut) || "—"} />
              <Kpi
                label="Total Hours"
                loading={loading}
                value={
                  state === "completed" && toNumber(today?.TotalHours) !== null
                    ? `${formatHours(today?.TotalHours)} hrs`
                    : state === "working"
                      ? "In Progress"
                      : "—"
                }
              />
            </div>

            {progress && data && (
              <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50/40 p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[13.5px] font-semibold text-gray-900">Today&apos;s Work Progress</div>
                  <div className="flex gap-4 text-[12.5px] text-gray-600 tabular-nums">
                    <span>
                      Elapsed <strong className="text-gray-900">{duration(progress.worked)}</strong>
                    </span>
                    <span>
                      {progress.pastEnd ? (
                        "Scheduled hours complete"
                      ) : (
                        <>
                          Remaining <strong className="text-gray-900">{duration(progress.remaining)}</strong>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className="relative h-2 rounded-full bg-gray-200"
                  role="progressbar"
                  aria-label="Workday progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(((progress.nowPct - progress.startPct) / Math.max(1, progress.endPct - progress.startPct)) * 100)}
                >
                  <div
                    className="absolute inset-y-0 rounded-full bg-sky-600"
                    style={{ left: `${progress.inPct}%`, width: `${Math.max(0, progress.nowPct - progress.inPct)}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-700 shadow"
                    style={{ left: `${progress.inPct}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-600 shadow"
                    style={{ left: `${progress.nowPct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11.5px] text-gray-500 tabular-nums">
                  <span>Start {formatTime(data.schedule.start)}</span>
                  <span>Time In {formatTime(today?.TimeIn)}</span>
                  <span>End {formatTime(data.schedule.end)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section aria-labelledby="actions-title" className={`${card} p-5`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="actions-title" className={cardTitle}>
                Quick Actions
              </h3>
              {state === "completed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[12.5px] font-semibold text-green-800 ring-1 ring-green-600/20">
                  <CheckCircle2 size={14} /> Attendance Completed
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <button
                onClick={() => clock("in")}
                disabled={!canTimeIn || !!acting}
                className={`${canTimeIn && state === "none" ? cls.btn : cls.btnSecondary} h-12 px-3 whitespace-nowrap`}
              >
                {acting === "in" ? <Loader2 size={17} className="animate-spin" /> : <LogIn size={17} />}
                {acting === "in" ? "Recording…" : "Time In"}
              </button>
              <button
                onClick={() => clock("out")}
                disabled={!canTimeOut || !!acting}
                className={`${canTimeOut ? cls.btn : cls.btnSecondary} h-12 px-3 whitespace-nowrap`}
              >
                {acting === "out" ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
                {acting === "out" ? "Recording…" : "Time Out"}
              </button>
              <Link href="/my-qr" className={`${cls.btnSecondary} h-12 px-3 whitespace-nowrap`}>
                <IdCard size={17} /> My QR Code
              </Link>
              <Link href="/my-attendance" className={`${cls.btnSecondary} h-12 px-3 whitespace-nowrap`}>
                <CalendarDays size={17} /> My Attendance
              </Link>
            </div>
          </section>

          {/* Recent + schedule/profile */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
            <section aria-labelledby="recent-title" className={`${card} lg:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-3">
                <div>
                  <h3 id="recent-title" className={cardTitle}>
                    Recent Attendance
                  </h3>
                  <p className="text-[12.5px] text-gray-500">Your latest attendance records</p>
                </div>
                <Link href="/my-attendance" className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                  View Full DTR
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3 px-5 pb-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : data.recent.length === 0 ? (
                <div className="px-5 pt-4 pb-8 text-center">
                  <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <CalendarCheck2 size={20} />
                  </div>
                  <div className="text-[14px] font-semibold text-gray-900">No attendance history yet.</div>
                  <p className="mt-0.5 text-[12.5px] text-gray-500">Your attendance records will appear here after your first time-in.</p>
                  {canTimeIn && (
                    <button onClick={() => clock("in")} disabled={!!acting} className={`${cls.btn} mt-3 h-11`}>
                      <LogIn size={16} /> Time In
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="w-full min-w-[520px] text-[13.5px]">
                    <thead>
                      <tr className="bg-gray-50 text-left text-[11px] font-bold tracking-wide text-gray-500 uppercase">
                        <th className="px-5 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Time In</th>
                        <th className="px-3 py-2.5">Time Out</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-5 py-2.5 text-right">Work Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r) => (
                        <tr key={r.AttendanceID} className="border-t border-gray-100">
                          <td className="px-5 py-2.5 font-medium whitespace-nowrap text-gray-900">{formatDate(r.Date)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatTime(r.TimeIn) || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                            {r.TimeOut ? formatTime(r.TimeOut) : r.Date === data.todayDate && r.TimeIn ? <span className="text-[12px] font-semibold text-sky-700">In progress</span> : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={r.Status} />
                          </td>
                          <td className="px-5 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {toNumber(r.TotalHours) === null ? "—" : `${formatHours(r.TotalHours)} hrs`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-5">
              <section aria-labelledby="schedule-title" className={`${card} p-5`}>
                <h3 id="schedule-title" className={cardTitle}>
                  Today&apos;s Schedule
                </h3>
                {loading ? (
                  <div className="mt-3 space-y-2.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : (
                  <>
                    <div className="mt-0.5 text-[12.5px] text-gray-500">{data.schedule.name}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <div>
                        <div className="text-[17px] font-bold text-gray-900 tabular-nums">{formatTime(data.schedule.start) || "—"}</div>
                        <div className="text-[11.5px] text-gray-500">Start Time</div>
                      </div>
                      <div>
                        <div className="text-[17px] font-bold text-gray-900 tabular-nums">{formatTime(data.schedule.end) || "—"}</div>
                        <div className="text-[11.5px] text-gray-500">End Time</div>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-[13px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Lunch Break</dt>
                        <dd className="text-right font-medium text-gray-900 tabular-nums">
                          {data.schedule.lunchStart && data.schedule.lunchEnd
                            ? `${formatTime(data.schedule.lunchStart)} – ${formatTime(data.schedule.lunchEnd)}`
                            : "None"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Working Hours</dt>
                        <dd className="font-medium text-gray-900">
                          {Math.round((data.schedule.workMinutes / 60) * 10) / 10} hours
                        </dd>
                      </div>
                      {Number(data.schedule.graceMinutes) > 0 && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-gray-500">Grace Period</dt>
                          <dd className="font-medium text-gray-900">{data.schedule.graceMinutes} min</dd>
                        </div>
                      )}
                    </dl>
                  </>
                )}
              </section>

              <section aria-labelledby="profile-title" className={`${card} p-5`}>
                <h3 id="profile-title" className="sr-only">
                  My profile
                </h3>
                {loading ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar name={data.employee.FullName} photoUrl={data.employee.PhotoURL} size={48} />
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-bold text-gray-900">{data.employee.FullName}</div>
                        <div className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-500">
                          <span className={`h-2 w-2 rounded-full ${data.employee.Status === "Active" ? "bg-green-600" : "bg-gray-400"}`} aria-hidden />
                          {data.employee.Status}
                        </div>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      {[
                        ["Employee ID", data.employee.EmployeeID],
                        ["Department", data.employee.Department],
                        ["Position", data.employee.Position],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="shrink-0 text-gray-500">{k}</dt>
                          <dd className={`min-w-0 text-right break-words ${v ? "font-medium text-gray-900" : "text-gray-400"}`}>{v || "Not assigned"}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link href="/profile" className={`${cls.btnSecondary} mt-3.5 h-11 w-full`}>
                      <UserRound size={16} /> View Profile
                    </Link>
                  </>
                )}
              </section>
            </div>
          </div>

          {/* Month summary + calendar */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <section aria-labelledby="month-title" className={`${card} p-5`}>
              <h3 id="month-title" className={cardTitle}>
                This Month
              </h3>
              <p className="text-[12.5px] text-gray-500">Working days up to today</p>
              {loading ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {[
                      { label: "Present", value: month.attended, unit: month.attended === 1 ? "day" : "days", tone: "text-green-800" },
                      { label: "Late", value: month.late, unit: month.late === 1 ? "day" : "days", tone: "text-amber-700" },
                      { label: "Absent", value: month.absent, unit: month.absent === 1 ? "day" : "days", tone: "text-red-700" },
                      { label: "Total Hours", value: month.hours, unit: "hrs", tone: "text-indigo-700" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-3">
                        <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{s.label}</div>
                        <div className={`mt-1 text-[22px] leading-none font-bold tabular-nums ${s.tone}`}>
                          {s.value}
                          <span className="ml-1 text-[12.5px] font-semibold text-gray-500">{s.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-semibold text-gray-900">Attendance Rate</span>
                      <span className="font-bold text-green-800 tabular-nums">
                        {month.rate === null ? "—" : `${(month.rate * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"
                      role="progressbar"
                      aria-label="Attendance rate this month"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={month.rate === null ? 0 : Math.round(month.rate * 100)}
                    >
                      <div className="h-full rounded-full bg-green-600 transition-[width] duration-300" style={{ width: `${(month.rate ?? 0) * 100}%` }} />
                    </div>
                    {month.rate === null && <p className="mt-1.5 text-[12px] text-gray-500">No working days recorded yet this month.</p>}
                  </div>
                </>
              )}
            </section>

            <section aria-labelledby="calendar-title" className={`${card} p-5`}>
              <h3 id="calendar-title" className={`${cardTitle} mb-1`}>
                Attendance Calendar
              </h3>
              {loading ? (
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                  ))}
                </div>
              ) : (
                <AttendanceCalendar monthKey={data.month.key} days={data.month.days} today={data.todayDate} />
              )}
            </section>
          </div>

          {/* Notifications + announcements */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section aria-labelledby="notif-title" className={`${card} p-5`}>
              <h3 id="notif-title" className={`${cardTitle} flex items-center gap-2`}>
                <Bell size={16} /> Notifications
              </h3>
              {loading ? (
                <Skeleton className="mt-3 h-10 w-full" />
              ) : data.notifications.length === 0 ? (
                <p className="mt-3 text-[13.5px] text-gray-500">No new notifications.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.notifications.map((n) => (
                    <li key={n.id} className="flex items-start gap-2.5 text-[13.5px] text-gray-800">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.tone === "success" ? "bg-green-600" : n.tone === "warning" ? "bg-amber-500" : "bg-gray-400"
                        }`}
                      />
                      {n.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="ann-title" className={`${card} p-5`}>
              <h3 id="ann-title" className={`${cardTitle} flex items-center gap-2`}>
                <Megaphone size={16} /> Announcements
              </h3>
              {loading ? (
                <Skeleton className="mt-3 h-10 w-full" />
              ) : data.announcement ? (
                <div className="mt-3">
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-gray-800">{data.announcement.text}</p>
                  {data.announcement.updated && <p className="mt-2 text-[11.5px] text-gray-400">Posted {data.announcement.updated}</p>}
                </div>
              ) : (
                <p className="mt-3 text-[13.5px] text-gray-500">No announcements at this time.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
