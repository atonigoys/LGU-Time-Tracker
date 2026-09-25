"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Plane, RefreshCw, Send, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { Select } from "@/components/Select";
import { LeaveStatusBadge } from "@/components/LeaveStatusBadge";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { call } from "@/lib/api";
import { cachedCall } from "@/lib/cache";
import { markLeaveDecisionsSeen } from "@/lib/notifications";
import { cls } from "@/lib/ui";
import { addDays, formatDate, formatTime, manilaToday } from "@/lib/format";
import { LEAVE_TYPES, type LeaveRequest } from "@/lib/types";

const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";
const REASON_MAX = 500;

function range(from: string, to: string) {
  return from === to ? formatDate(from, "long") : `${formatDate(from)} – ${formatDate(to)}`;
}
function when(ts: string) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(ts);
  return m ? `${formatDate(m[1])}, ${formatTime(m[2])}` : "";
}
function dayCount(from: string, to: string) {
  if (!from || !to || to < from) return 0;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
}

export default function MyLeavePage() {
  const session = useRequireAuth(["Employee"]);
  const toast = useToast();
  const confirm = useConfirm();
  const today = manilaToday();

  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [type, setType] = useState("Vacation");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const userId = session?.user.employeeId;
  const load = useCallback(async () => {
    setError(false);
    try {
      await cachedCall<{ leaves: LeaveRequest[] }>("getLeaves", {}, (res) => {
        setLeaves(res.leaves);
        // Opening this page counts as seeing any approvals/rejections.
        if (userId) markLeaveDecisionsSeen(userId, res.leaves);
      }, { revalidate: true });
    } catch (err) {
      console.error("getLeaves failed", err);
      setError(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    load();
  }, [session, load]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (saving) return;
    setFormError("");
    if (!from || !to) return setFormError("Please choose the start and end dates.");
    if (to < from) return setFormError("The end date must be on or after the start date.");
    if (!reason.trim()) return setFormError("Please enter a reason.");
    const days = dayCount(from, to);
    const ok = await confirm({
      title: "Submit this leave request?",
      message: "HR will review it. You'll be notified once it's approved or rejected.",
      details: (
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-[13.5px]">
          <div className="font-semibold text-gray-900">
            {type} leave · {days} day{days === 1 ? "" : "s"}
          </div>
          <div className="text-gray-600">{range(from, to)}</div>
          <p className="mt-1 line-clamp-3 break-words text-gray-500">{reason.trim()}</p>
        </div>
      ),
      confirmLabel: "Yes, submit",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await call("requestLeave", { data: { LeaveType: type, StartDate: from, EndDate: to, Reason: reason.trim() } });
      toast("Leave request submitted. HR will review it.");
      setReason("");
      setFrom(today);
      setTo(today);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to submit your request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(l: LeaveRequest) {
    const ok = await confirm({
      title: "Cancel this leave request?",
      message: `${l.LeaveType} leave, ${range(l.StartDate, l.EndDate)}. You can file a new one later.`,
      confirmLabel: "Yes, cancel it",
      cancelLabel: "Keep request",
      tone: "warning",
    });
    if (!ok) return;
    setCancelling(l.LeaveID);
    try {
      await call("cancelLeaveRequest", { leaveId: l.LeaveID });
      setLeaves((prev) => prev?.map((x) => (x.LeaveID === l.LeaveID ? { ...x, Status: "Cancelled" } : x)) ?? prev);
      toast("Leave request cancelled.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to cancel the request.", true);
    } finally {
      setCancelling(null);
    }
  }

  if (!session) return null;
  const days = dayCount(from, to);
  const pending = leaves?.filter((l) => l.Status === "Pending").length ?? 0;

  return (
    <AppShell title="My Leave">
      <div className="mb-5">
        <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">My Leave</h2>
        <p className="mt-1 text-[14px] text-gray-500">File a leave request and track its approval.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section aria-labelledby="file-title" className={`${card} p-5`}>
          <h3 id="file-title" className="mb-3 flex items-center gap-2 text-[15px] font-bold text-green-900">
            <CalendarPlus size={17} /> File a Leave
          </h3>
          <form onSubmit={submit} noValidate className="space-y-3.5">
            {formError && (
              <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {formError}
              </div>
            )}
            <div>
              <label className={cls.label}>Leave type</label>
              <Select value={type} onChange={setType} aria-label="Leave type" className="w-full" options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lv-from" className={cls.label}>
                  From
                </label>
                <input
                  id="lv-from"
                  type="date"
                  value={from}
                  min={addDays(today, -30)}
                  max={addDays(today, 366)}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (to < e.target.value) setTo(e.target.value);
                  }}
                  className={cls.input}
                />
              </div>
              <div>
                <label htmlFor="lv-to" className={cls.label}>
                  To
                </label>
                <input id="lv-to" type="date" value={to} min={from} max={addDays(today, 366)} onChange={(e) => setTo(e.target.value)} className={cls.input} />
              </div>
            </div>
            {days > 0 && <p className="-mt-1.5 text-[12px] text-gray-500">{days} calendar day{days === 1 ? "" : "s"}</p>}
            <div>
              <label htmlFor="lv-reason" className={cls.label}>
                Reason
              </label>
              <textarea
                id="lv-reason"
                rows={4}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Family event in the province"
                className={`${cls.input} resize-y`}
              />
              <div className="mt-1 text-right text-[11.5px] text-gray-400 tabular-nums">
                {reason.length}/{REASON_MAX}
              </div>
            </div>
            <button type="submit" disabled={saving} className={`${cls.btn} h-11 w-full`}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </section>

        <section aria-labelledby="history-title" className={card}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h3 id="history-title" className="text-[15px] font-bold text-green-900">
                My Requests
              </h3>
              {pending > 0 && <p className="text-[12.5px] text-gray-500">{pending} waiting for approval</p>}
            </div>
            <button onClick={() => load()} className={`${cls.btnSecondary} ${cls.btnSmall}`} aria-label="Refresh requests">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {error && !leaves ? (
            <div className="px-5 pb-8 text-center text-[13.5px] text-gray-600">
              Unable to load your requests.{" "}
              <button onClick={() => load()} className="font-semibold text-green-700 hover:underline">
                Retry
              </button>
            </div>
          ) : !leaves ? (
            <div className="space-y-3 px-5 pb-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : leaves.length === 0 ? (
            <div className="px-5 pt-4 pb-10 text-center">
              <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Plane size={20} />
              </div>
              <div className="text-[14px] font-semibold text-gray-900">No leave requests yet</div>
              <p className="mt-0.5 text-[12.5px] text-gray-500">Requests you file will appear here with their status.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {leaves.map((l) => (
                <li key={l.LeaveID} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-semibold text-gray-900">{l.LeaveType} leave</span>
                        <LeaveStatusBadge status={l.Status} />
                      </div>
                      <div className="mt-0.5 text-[13px] text-gray-700">
                        {range(l.StartDate, l.EndDate)} · {l.Days} day{l.Days === 1 ? "" : "s"}
                      </div>
                    </div>
                    {l.Status === "Pending" && l.Source === "Employee" && (
                      <button onClick={() => cancel(l)} disabled={cancelling === l.LeaveID} className={`${cls.btnSecondary} ${cls.btnSmall}`}>
                        {cancelling === l.LeaveID ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        {cancelling === l.LeaveID ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                  {l.Reason && <p className="mt-1.5 text-[13px] break-words text-gray-600">{l.Reason}</p>}
                  {(l.Status === "Approved" || l.Status === "Rejected") && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-[12.5px] ${l.Status === "Approved" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>
                      {l.Status} {l.ReviewedByName ? `by ${l.ReviewedByName}` : ""}
                      {l.ReviewedAt ? ` · ${when(l.ReviewedAt)}` : ""}
                      {l.Remarks && <div className="mt-0.5 text-gray-700">“{l.Remarks}”</div>}
                    </div>
                  )}
                  <div className="mt-1.5 text-[11.5px] text-gray-400">
                    {l.Source === "HR" ? "Recorded by HR" : l.FiledAt ? `Filed ${when(l.FiledAt)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
