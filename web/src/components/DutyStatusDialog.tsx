"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, Briefcase, CalendarOff, Loader2, Palmtree, UserCheck, X } from "lucide-react";
import { cls } from "@/lib/ui";
import { call } from "@/lib/api";
import { addDays, formatDate, manilaToday } from "@/lib/format";
import { Select } from "@/components/Select";
import type { DutyInfo, DutyStatus, Employee } from "@/lib/types";

const OPTIONS: Array<{ value: DutyStatus; label: string; hint: string; icon: typeof UserCheck; tone: string }> = [
  { value: "On Duty", label: "On Duty", hint: "Expected to time in", icon: UserCheck, tone: "text-green-700 bg-green-50 ring-green-600/25" },
  { value: "On Leave", label: "On Leave", hint: "Not counted absent", icon: Palmtree, tone: "text-sky-700 bg-sky-50 ring-sky-600/25" },
  { value: "Day Off", label: "Day Off", hint: "Rest day", icon: CalendarOff, tone: "text-gray-700 bg-gray-100 ring-gray-400/30" },
  { value: "Official Business", label: "Official Business", hint: "Working outside, counted present", icon: Briefcase, tone: "text-teal-700 bg-teal-50 ring-teal-600/25" },
];
const LEAVE_TYPES = ["Vacation", "Sick", "Emergency", "Maternity", "Paternity", "Special Privilege", "Other"];

/** Badge for an employee's current duty status. */
export function DutyBadge({ duty }: { duty?: DutyInfo }) {
  const status = duty?.status ?? "On Duty";
  const opt = OPTIONS.find((o) => o.value === status) ?? OPTIONS[0];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${opt.tone}`}>
      <opt.icon size={12} aria-hidden />
      {status}
      {duty?.type ? ` · ${duty.type}` : ""}
    </span>
  );
}

export function DutyStatusDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: (employeeId: string, duty: DutyInfo, message: string) => void;
}) {
  return (
    <Dialog.Root open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[210] max-h-[90vh] w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] focus:outline-none data-[state=open]:animate-[modal-in_180ms_ease-out]"
        >
          {employee && <DutyForm key={employee.EmployeeID} employee={employee} onClose={onClose} onSaved={onSaved} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DutyForm({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: (employeeId: string, duty: DutyInfo, message: string) => void;
}) {
  const today = manilaToday();
  const current = employee.Duty?.status ?? "On Duty";
  const [status, setStatus] = useState<DutyStatus>(current === "On Duty" ? "On Leave" : "On Duty");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [leaveType, setLeaveType] = useState("Vacation");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const needsDates = status !== "On Duty";
  const days = needsDates && from && to && to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError("");
    if (status === "On Duty" && current === "On Duty") return setError(`${employee.FullName} is already on duty.`);
    if (needsDates) {
      if (!from || !to) return setError("Please choose the start and end dates.");
      if (to < from) return setError("The end date must be on or after the start date.");
    }
    setSaving(true);
    try {
      const res = await call<{ duty: DutyInfo }>("setDutyStatus", {
        data: { EmployeeID: employee.EmployeeID, Status: status, From: from, To: to, LeaveType: leaveType, Note: note.trim() },
      });
      const range = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
      onSaved(
        employee.EmployeeID,
        res.duty,
        status === "On Duty" ? `${employee.FullName} is back on duty.` : `${employee.FullName} set to ${status}${status === "On Leave" ? ` (${leaveType})` : ""} for ${range}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the status. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div aria-hidden className="h-1 bg-gradient-to-r from-green-800 via-green-600 to-green-700" />
      <div className="flex items-start justify-between px-6 pt-5">
        <div>
          <Dialog.Title className="text-[18px] font-bold text-green-950">Set Duty Status</Dialog.Title>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {employee.FullName} · currently <strong className="font-semibold text-gray-700">{current}</strong>
            {employee.Duty?.to && current !== "On Duty" ? ` until ${formatDate(employee.Duty.to)}` : ""}
          </p>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
        >
          <X size={18} />
        </Dialog.Close>
      </div>

      <div className="space-y-4 px-6 py-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            <AlertCircle size={16} className="mt-px shrink-0" /> {error}
          </div>
        )}

        <fieldset>
          <legend className={cls.label}>Status</legend>
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map((o) => {
              const selected = status === o.value;
              return (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors duration-150 ${
                    selected ? "border-green-600 bg-green-50/60 ring-1 ring-green-600" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input type="radio" name="duty" value={o.value} checked={selected} onChange={() => setStatus(o.value)} className="sr-only" />
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${o.tone}`}>
                    <o.icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-gray-900">{o.label}</span>
                    <span className="block text-[11.5px] leading-snug text-gray-500">{o.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {status === "On Leave" && (
          <div>
            <label className={cls.label}>Leave type</label>
            <Select value={leaveType} onChange={setLeaveType} aria-label="Leave type" className="w-full" options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} />
          </div>
        )}

        {needsDates ? (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="duty-from" className={cls.label}>
                  From
                </label>
                <input id="duty-from" type="date" value={from} max={addDays(today, 366)} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className={cls.input} />
              </div>
              <div>
                <label htmlFor="duty-to" className={cls.label}>
                  To
                </label>
                <input id="duty-to" type="date" value={to} min={from} max={addDays(today, 366)} onChange={(e) => setTo(e.target.value)} className={cls.input} />
              </div>
            </div>
            <p className="mt-1.5 text-[12px] text-gray-500">
              {days > 0 ? `${days} day${days === 1 ? "" : "s"}. ` : ""}The employee returns to On Duty automatically after the end date.
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-green-50 px-3 py-2.5 text-[13px] text-green-900">
            Ends the current {current.toLowerCase()} today. The employee is expected to time in again.
          </p>
        )}

        <div>
          <label htmlFor="duty-note" className={cls.label}>
            Note <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input id="duty-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Seminar in the provincial capitol" className={cls.input} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2.5 border-t border-gray-100 bg-gray-50/60 px-6 py-4 min-[400px]:flex-row min-[400px]:justify-end">
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-gray-300 bg-white px-5 text-[14px] font-medium text-green-800 hover:bg-green-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${cls.btn} h-11 min-w-[140px]`}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save Status"}
        </button>
      </div>
    </form>
  );
}
