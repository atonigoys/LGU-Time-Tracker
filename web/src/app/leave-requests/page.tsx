"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Check, ClipboardCheck, Loader2, RefreshCw, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/Skeleton";
import { LeaveStatusBadge } from "@/components/LeaveStatusBadge";
import { useRequireAuth } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/api";
import { cachedCall, useLiveRefresh } from "@/lib/cache";
import { cls } from "@/lib/ui";
import { formatDate, formatTime } from "@/lib/format";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";

const card = "rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,16,0.04)]";
const TABS: Array<{ key: LeaveStatus | "All"; label: string }> = [
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "All", label: "All" },
];

function range(from: string, to: string) {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}
function when(ts: string) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(ts);
  return m ? `${formatDate(m[1])}, ${formatTime(m[2])}` : "";
}

type Review = { leave: LeaveRequest; decision: "Approved" | "Rejected" } | null;

export default function LeaveRequestsPage() {
  const session = useRequireAuth(["Admin", "HR"]);
  const toast = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<LeaveStatus | "All">("Pending");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<Review>(null);
  const [saving, setSaving] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setError(false);
    setRefreshing(true);
    try {
      await cachedCall<{ leaves: LeaveRequest[] }>("getLeaves", {}, (res) => setLeaves(res.leaves), { revalidate: true });
    } catch (err) {
      console.error("getLeaves failed", err);
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

  useLiveRefresh(load, 60_000, !!session);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Pending: 0, Approved: 0, Rejected: 0, All: 0 };
    (leaves ?? []).forEach((l) => {
      c[l.Status] = (c[l.Status] ?? 0) + 1;
      c.All++;
    });
    return c;
  }, [leaves]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (leaves ?? [])
      .filter((l) => tab === "All" || l.Status === tab || (tab === "Pending" && saving.has(l.LeaveID)))
      .filter((l) => !q || `${l.EmployeeName} ${l.EmployeeID} ${l.Department} ${l.LeaveType}`.toLowerCase().includes(q))
      // Pending: oldest first so nothing waits too long; others newest first.
      .sort((a, b) => (tab === "Pending" ? 1 : -1) * (a.FiledAt || a.StartDate).localeCompare(b.FiledAt || b.StartDate));
  }, [leaves, tab, search, saving]);

  if (!session) return null;

  return (
    <AppShell title="Leave Requests">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-green-950 sm:text-2xl">Leave Requests</h2>
          <p className="mt-1 text-[14px] text-gray-500">Review leave filed by employees. Approved leave sets the employee On Leave for those dates.</p>
        </div>
        <button onClick={() => load()} disabled={refreshing} className={`${cls.btnSecondary} w-fit`} aria-label="Refresh leave requests">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <section aria-label="Leave requests" className={card}>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div role="tablist" aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none ${
                  tab === t.key ? "border-green-700 text-green-900" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t.label}
                {leaves && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums ${
                      t.key === "Pending" && counts.Pending ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {counts[t.key] ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative pb-3 sm:w-64">
            <label htmlFor="lr-search" className="sr-only">
              Search requests
            </label>
            <Search size={15} className="pointer-events-none absolute top-[calc(50%-6px)] left-3 -translate-y-1/2 text-gray-400" />
            <input id="lr-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or type" className={`${cls.input} py-2 pl-9`} />
          </div>
        </div>

        {error && !leaves ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-gray-600">
            Unable to load leave requests.{" "}
            <button onClick={() => load()} className="font-semibold text-green-700 hover:underline">
              Retry
            </button>
          </div>
        ) : !leaves ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <ClipboardCheck size={22} />
            </div>
            <div className="font-semibold text-gray-900">{tab === "Pending" ? "No pending requests" : "No requests here"}</div>
            <p className="mt-1 text-[13.5px] text-gray-500">{tab === "Pending" ? "You're all caught up." : "Try another tab or search."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((l) => (
              <li key={l.LeaveID} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-gray-900">{l.EmployeeName || l.EmployeeID}</span>
                      <LeaveStatusBadge status={l.Status} />
                      {l.Source === "HR" && <span className="text-[11px] font-semibold text-gray-500">Recorded by HR</span>}
                    </div>
                    <div className="text-[12px] text-gray-500">{l.Department}</div>
                    <div className="mt-1.5 text-[13.5px] text-gray-800">
                      <strong className="font-semibold">{l.LeaveType} leave</strong> · {range(l.StartDate, l.EndDate)} · {l.Days} day{l.Days === 1 ? "" : "s"}
                    </div>
                    {l.Reason && <p className="mt-1 text-[13px] break-words whitespace-pre-wrap text-gray-600">{l.Reason}</p>}
                    <div className="mt-1.5 text-[11.5px] text-gray-400">
                      {l.FiledAt && `Filed ${when(l.FiledAt)}`}
                      {(l.Status === "Approved" || l.Status === "Rejected") && l.ReviewedAt
                        ? ` · ${l.Status} by ${l.ReviewedByName || "HR"} ${when(l.ReviewedAt)}`
                        : ""}
                    </div>
                    {l.Remarks && <div className="mt-1 text-[12.5px] text-gray-600">Remarks: “{l.Remarks}”</div>}
                  </div>
                  {saving.has(l.LeaveID) ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-gray-500">
                      <Loader2 size={14} className="animate-spin" /> Saving…
                    </span>
                  ) : l.Status === "Pending" && (
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setReview({ leave: l, decision: "Rejected" })} className={`${cls.btnSecondary} ${cls.btnSmall} text-red-600 hover:bg-red-50`}>
                        <X size={14} /> Reject
                      </button>
                      <button onClick={() => setReview({ leave: l, decision: "Approved" })} className={`${cls.btn} ${cls.btnSmall}`}>
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReviewDialog
        review={review}
        onClose={() => setReview(null)}
        onSubmit={async (leave, decision, remarks) => {
          // Close and update right away; the server confirms in the background.
          const before = leave;
          const name = session.user.fullName;
          setReview(null);
          setLeaves((prev) => prev?.map((x) => (x.LeaveID === leave.LeaveID ? { ...x, Status: decision, Remarks: remarks, ReviewedByName: name } : x)) ?? prev);
          setSaving((s) => new Set(s).add(leave.LeaveID));
          try {
            await call("updateLeaveStatus", { leaveId: leave.LeaveID, status: decision, remarks });
            toast(decision === "Approved" ? `Leave approved. ${leave.EmployeeName} is set On Leave for those dates.` : "Leave request rejected.");
          } catch (err) {
            setLeaves((prev) => prev?.map((x) => (x.LeaveID === leave.LeaveID ? before : x)) ?? prev);
            toast(err instanceof Error ? err.message : "Unable to update the request. Please try again.", true);
          } finally {
            setSaving((s) => {
              const n = new Set(s);
              n.delete(leave.LeaveID);
              return n;
            });
            load();
          }
        }}
      />
    </AppShell>
  );
}

function ReviewDialog({
  review,
  onClose,
  onSubmit,
}: {
  review: Review;
  onClose: () => void;
  onSubmit: (leave: LeaveRequest, decision: "Approved" | "Rejected", remarks: string) => void;
}) {
  return (
    <Dialog.Root open={!!review} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[210] w-[calc(100vw-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] focus:outline-none data-[state=open]:animate-[modal-in_180ms_ease-out]"
        >
          {review && <ReviewForm key={review.leave.LeaveID + review.decision} review={review} onClose={onClose} onSubmit={onSubmit} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviewForm({
  review,
  onClose,
  onSubmit,
}: {
  review: NonNullable<Review>;
  onClose: () => void;
  onSubmit: (leave: LeaveRequest, decision: "Approved" | "Rejected", remarks: string) => void;
}) {
  const { leave, decision } = review;
  const approving = decision === "Approved";
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!approving && !remarks.trim()) return setError("Please give a reason for rejecting.");
    onSubmit(leave, decision, remarks.trim());
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="px-6 pt-5 pb-5">
        <Dialog.Close
          aria-label="Close"
          className="absolute top-4 right-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
        >
          <X size={18} />
        </Dialog.Close>
        <div className="flex items-start gap-4 pr-6">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${
              approving ? "bg-green-50 text-green-700 ring-green-600/15" : "bg-red-50 text-red-600 ring-red-500/20"
            }`}
          >
            {approving ? <Check size={20} /> : <X size={20} />}
          </div>
          <div>
            <Dialog.Title className="text-[19px] leading-tight font-bold text-green-950">{approving ? "Approve this leave?" : "Reject this leave?"}</Dialog.Title>
            <p className="mt-1.5 text-[14px] text-gray-600">
              {approving ? `${leave.EmployeeName} will be set On Leave and won't be counted absent.` : `${leave.EmployeeName} will be notified with your reason.`}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-[13.5px]">
          <div className="font-semibold text-gray-900">
            {leave.LeaveType} leave · {leave.Days} day{leave.Days === 1 ? "" : "s"}
          </div>
          <div className="text-gray-600">{range(leave.StartDate, leave.EndDate)}</div>
          {leave.Reason && <p className="mt-1 line-clamp-3 break-words text-gray-500">{leave.Reason}</p>}
        </div>
        <div className="mt-4">
          <label htmlFor="review-remarks" className={cls.label}>
            {approving ? (
              <>
                Remarks <span className="font-normal text-gray-400">(optional)</span>
              </>
            ) : (
              <>
                Reason for rejecting <span className="text-red-600">*</span>
              </>
            )}
          </label>
          <textarea
            id="review-remarks"
            rows={3}
            maxLength={300}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={approving ? "e.g. Approved. Please endorse your tasks." : "e.g. Conflicts with the scheduled audit."}
            className={`${cls.input} resize-none`}
          />
        </div>
        {error && (
          <div role="alert" className="mt-3 flex items-center gap-2 text-[13px] text-red-700">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2.5 border-t border-gray-100 bg-gray-50/60 px-6 py-4 min-[400px]:flex-row min-[400px]:justify-end">
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-gray-300 bg-white px-5 text-[14px] font-medium text-green-800 hover:bg-green-50">
          Cancel
        </button>
        <button
          type="submit"
          className={`inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-[10px] px-5 text-[14px] font-semibold text-white transition-colors ${
            approving ? "bg-green-700 hover:bg-green-800" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {approving ? "Yes, approve" : "Yes, reject"}
        </button>
      </div>
    </form>
  );
}
