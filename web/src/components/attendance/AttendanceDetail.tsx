"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, UserRound, X } from "lucide-react";
import { StatusBadge } from "@/components/Badge";
import { cls } from "@/lib/ui";
import { formatDate, formatDateTime, formatHours, formatTime, toNumber } from "@/lib/format";
import type { AttendanceRecord, AttendanceSchedule } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-[11.5px] font-semibold tracking-wide text-gray-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-gray-900">{children}</dd>
    </div>
  );
}

function sourceLabel(r: AttendanceRecord) {
  if (r.Derived) return "No scan recorded";
  const s = (r.Source || r.Device || "").trim();
  if (!s) return "Not available";
  if (/manual/i.test(s)) return s;
  if (/^web$/i.test(s)) return "Web (self-service)";
  // Scans store the scanner device's browser user agent.
  return "QR Scanner";
}

export function AttendanceDetail({
  record,
  schedule,
  canEdit,
  onClose,
  onEdit,
}: {
  record: AttendanceRecord | null;
  schedule: AttendanceSchedule | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (r: AttendanceRecord) => void;
}) {
  const r = record;
  const late = r ? toNumber(r.LateMinutes) : null;
  const scheduleText = schedule
    ? `${formatTime(schedule.StartTime).replace(/^0/, "")} – ${formatTime(schedule.EndTime).replace(/^0/, "")}`
    : "Not available";

  return (
    <Dialog.Root open={!!r} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[180] bg-black/35 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[190] flex w-full max-w-[440px] flex-col bg-white shadow-2xl focus:outline-none data-[state=open]:animate-[drawer-in_200ms_ease-out]"
        >
          {r && (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <Dialog.Title className="text-[17px] font-bold text-green-900">Attendance Details</Dialog.Title>
                <Dialog.Close
                  aria-label="Close details"
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
                >
                  <X size={18} />
                </Dialog.Close>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-2">
                <dl className="divide-y divide-gray-100">
                  <Field label="Employee">
                    <span className="font-semibold">{r.FullName || "Unknown"}</span>
                  </Field>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Employee ID">
                      <span className="break-all">{r.EmployeeID}</span>
                    </Field>
                    <Field label="Department">{r.Department || "Not available"}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Date">{formatDate(r.Date, "long")}</Field>
                    <Field label="Schedule">{scheduleText}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Time In">{formatTime(r.TimeIn, true) || "—"}</Field>
                    <Field label="Time Out">
                      {r.TimeOut ? formatTime(r.TimeOut, true) : r.TimeIn && r.Status !== "INCOMPLETE" ? "In progress" : "—"}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Status">
                      <StatusBadge status={r.Status} />
                      {r.HolidayName && <div className="mt-1 text-[12.5px] text-gray-500">{r.HolidayName}</div>}
                      {r.LeaveType && <div className="mt-1 text-[12.5px] text-gray-500">{r.LeaveType} leave</div>}
                    </Field>
                    <Field label="Late">{late === null ? "—" : `${late} minute${late === 1 ? "" : "s"}`}</Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Working Hours">
                      {toNumber(r.TotalHours) === null ? "—" : `${formatHours(r.TotalHours)} hrs`}
                    </Field>
                    <Field label="Overtime">
                      {toNumber(r.OvertimeHours) === null ? "—" : `${formatHours(r.OvertimeHours)} hrs`}
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Source">{sourceLabel(r)}</Field>
                    <Field label="Created">{r.CreatedAt ? formatDateTime(r.CreatedAt) : "—"}</Field>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <Dialog.Close className={cls.btnSecondary}>Close</Dialog.Close>
                <Link href={`/employees?q=${encodeURIComponent(r.EmployeeID)}`} className={cls.btnSecondary}>
                  <UserRound size={15} /> View Employee
                </Link>
                {canEdit && (
                  <button onClick={() => onEdit(r)} className={cls.btn}>
                    <Pencil size={15} /> {r.Derived ? "Add Record" : "Edit Record"}
                  </button>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
