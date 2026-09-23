"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, X } from "lucide-react";
import { cls } from "@/lib/ui";
import { call } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AttendanceRecord } from "@/lib/types";

export type EditMode = "edit" | "timeIn" | "timeOut";

const TITLES: Record<EditMode, string> = {
  edit: "Edit Attendance",
  timeIn: "Correct Time In",
  timeOut: "Correct Time Out",
};

export function EditAttendanceDialog({
  target,
  onClose,
  onSaved,
}: {
  target: { record: AttendanceRecord; mode: EditMode } | null;
  onClose: () => void;
  onSaved: (previousId: string, saved: AttendanceRecord) => void;
}) {
  return (
    <Dialog.Root open={!!target} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[210] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl focus:outline-none"
        >
          {/* Keyed so the form resets each time a different record opens. */}
          {target && (
            <EditForm
              key={`${target.record.AttendanceID}:${target.mode}`}
              record={target.record}
              mode={target.mode}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditForm({
  record,
  mode,
  onClose,
  onSaved,
}: {
  record: AttendanceRecord;
  mode: EditMode;
  onClose: () => void;
  onSaved: (previousId: string, saved: AttendanceRecord) => void;
}) {
  const [timeIn, setTimeIn] = useState(record.TimeIn24 ?? "");
  const [timeOut, setTimeOut] = useState(record.TimeOut24 ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const title = record.Derived ? "Add Attendance Record" : TITLES[mode];

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError("");
    if (!timeIn) return setError("Time In is required.");
    if (timeOut && timeOut <= timeIn) {
      return setError("Invalid attendance time. Time Out must be later than Time In.");
    }
    if (!reason.trim()) return setError("Please enter a reason for this change.");

    setSaving(true);
    try {
      const res = await call<{ record: AttendanceRecord }>("updateAttendance", {
        data: {
          AttendanceID: record.AttendanceID,
          EmployeeID: record.EmployeeID,
          Date: record.Date,
          TimeIn: timeIn,
          TimeOut: timeOut,
          Reason: reason.trim(),
        },
      });
      onSaved(record.AttendanceID, res.record);
    } catch (err) {
      console.error("updateAttendance failed", err);
      setError(err instanceof Error ? err.message : "Unable to save changes. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <Dialog.Title className="text-[17px] font-bold text-green-900">{title}</Dialog.Title>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {record.FullName} · {formatDate(record.Date, "long")}
          </p>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
        >
          <X size={18} />
        </Dialog.Close>
      </div>

      <div className="space-y-4 px-5 py-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            <AlertCircle size={16} className="mt-px shrink-0" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-time-in" className={cls.label}>
              Time In
            </label>
            <input
              id="edit-time-in"
              type="time"
              value={timeIn}
              onChange={(e) => setTimeIn(e.target.value)}
              autoFocus={mode !== "timeOut"}
              disabled={mode === "timeOut" && !!record.TimeIn24}
              className={`${cls.input} disabled:bg-gray-50 disabled:text-gray-500`}
            />
          </div>
          <div>
            <label htmlFor="edit-time-out" className={cls.label}>
              Time Out
            </label>
            <input
              id="edit-time-out"
              type="time"
              value={timeOut}
              onChange={(e) => setTimeOut(e.target.value)}
              autoFocus={mode === "timeOut"}
              disabled={mode === "timeIn"}
              className={`${cls.input} disabled:bg-gray-50 disabled:text-gray-500`}
            />
            <p className="mt-1 text-[11.5px] text-gray-500">Leave blank if not yet timed out.</p>
          </div>
        </div>
        <div>
          <label htmlFor="edit-reason" className={cls.label}>
            Reason for change <span className="text-red-600">*</span>
          </label>
          <textarea
            id="edit-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee forgot to scan out."
            className={`${cls.input} resize-none`}
          />
          <p className="mt-1 text-[11.5px] text-gray-500">Saved to the audit log with the previous and new values.</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
        <button type="button" onClick={onClose} className={cls.btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={cls.btn}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
