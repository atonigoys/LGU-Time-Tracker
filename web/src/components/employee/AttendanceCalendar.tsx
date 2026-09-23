"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/Badge";
import { formatDate, formatHours, formatTime, toNumber } from "@/lib/format";
import type { CalendarDay } from "@/lib/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Subtle cell tints per status; text stays dark for contrast.
const CELL: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-900 ring-green-600/25",
  LATE: "bg-amber-50 text-amber-900 ring-amber-600/30",
  INCOMPLETE: "bg-orange-50 text-orange-900 ring-orange-600/25",
  ABSENT: "bg-red-50 text-red-800 ring-red-600/25",
  "ON LEAVE": "bg-sky-50 text-sky-900 ring-sky-600/25",
  HOLIDAY: "bg-violet-50 text-violet-900 ring-violet-600/25",
  REST: "bg-gray-50 text-gray-400 ring-gray-300/40",
  PENDING: "bg-white text-gray-900 ring-green-600/60",
  FUTURE: "bg-white text-gray-300 ring-gray-200/60",
  NONE: "bg-white text-gray-300 ring-gray-200/60",
};

const DOT: Record<string, string> = {
  PRESENT: "bg-green-600",
  LATE: "bg-amber-500",
  INCOMPLETE: "bg-orange-500",
  ABSENT: "bg-red-500",
  "ON LEAVE": "bg-sky-500",
  HOLIDAY: "bg-violet-500",
  REST: "bg-gray-300",
};

const LEGEND: Array<[string, string]> = [
  ["PRESENT", "Present"],
  ["LATE", "Late"],
  ["ABSENT", "Absent"],
  ["ON LEAVE", "Leave"],
  ["HOLIDAY", "Holiday"],
  ["REST", "Rest day"],
];

function statusText(d: CalendarDay) {
  if (d.status === "REST") return "Rest day";
  if (d.status === "PENDING") return "Not timed in yet";
  if (d.status === "FUTURE") return "Upcoming";
  if (d.status === "NONE") return "Before your start date";
  return "";
}

export function AttendanceCalendar({ monthKey, days, today }: { monthKey: string; days: CalendarDay[]; today: string }) {
  const [selected, setSelected] = useState<string>(today);
  const [y, m] = monthKey.split("-").map(Number);
  // Monday-first grid: blank cells before the 1st.
  const lead = days.length ? (days[0].dow + 6) % 7 : 0;
  const sel = days.find((d) => d.date === selected) ?? null;

  return (
    <div>
      <div className="mb-3 text-[14px] font-semibold text-gray-900">
        {MONTHS[(m || 1) - 1]} {y}
      </div>
      <div role="grid" aria-label={`Attendance calendar for ${MONTHS[(m || 1) - 1]} ${y}`} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} role="columnheader" className="pb-1 text-center text-[11px] font-semibold text-gray-400">
            {w}
          </div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const day = Number(d.date.slice(8));
          const isToday = d.date === today;
          const isSel = d.date === selected;
          return (
            <button
              key={d.date}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${formatDate(d.date, "long")}: ${statusText(d) || d.status}`}
              onClick={() => setSelected(d.date)}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-md text-[12.5px] font-medium ring-1 ring-inset transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:outline-none ${
                CELL[d.status] ?? CELL.NONE
              } ${isSel ? "shadow-[0_0_0_2px_#15803d]" : "hover:shadow-[0_0_0_1px_#9ca3af]"} ${isToday ? "font-bold" : ""}`}
            >
              {day}
              {DOT[d.status] && <span aria-hidden className={`absolute bottom-1 h-1 w-1 rounded-full ${DOT[d.status]}`} />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] text-gray-500">
        {LEGEND.map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[k]}`} />
            {label}
          </span>
        ))}
      </div>

      {sel && (
        <div aria-live="polite" className="mt-4 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13.5px] font-semibold text-gray-900">{formatDate(sel.date, "long")}</div>
            {statusText(sel) ? (
              <span className="text-[12px] text-gray-500">{statusText(sel)}</span>
            ) : (
              <StatusBadge status={sel.status} />
            )}
          </div>
          {(sel.holidayName || sel.leaveType) && (
            <div className="mt-1 text-[12px] text-gray-500">{sel.holidayName || `${sel.leaveType} leave`}</div>
          )}
          <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <dt className="text-gray-500">Time In</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{formatTime(sel.timeIn) || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Time Out</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{formatTime(sel.timeOut) || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Work Hours</dt>
              <dd className="font-medium text-gray-900 tabular-nums">
                {toNumber(sel.totalHours) === null ? "—" : `${formatHours(sel.totalHours)} hrs`}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
