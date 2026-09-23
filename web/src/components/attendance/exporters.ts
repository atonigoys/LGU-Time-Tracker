import { formatDate, formatHours, formatTime, manilaToday, toNumber } from "@/lib/format";
import { downloadDataUrl } from "@/lib/qr";
import type { AttendanceRecord } from "@/lib/types";

export interface ReportMeta {
  orgName: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  status: string;
  search: string;
}

const HEADERS = [
  "Date",
  "Employee ID",
  "Employee Name",
  "Department",
  "Time In",
  "Time Out",
  "Status",
  "Late Minutes",
  "Working Hours",
  "Overtime Hours",
];

function timeOutText(r: AttendanceRecord) {
  if (r.TimeOut) return formatTime(r.TimeOut);
  return r.TimeIn && r.Status !== "INCOMPLETE" ? "In progress" : "";
}

function rowValues(r: AttendanceRecord): Array<string | number | null> {
  return [
    r.Date,
    r.EmployeeID,
    r.FullName ?? "",
    r.Department ?? "",
    formatTime(r.TimeIn),
    timeOutText(r),
    r.Status,
    toNumber(r.LateMinutes),
    toNumber(r.TotalHours),
    toNumber(r.OvertimeHours),
  ];
}

function fileBase(meta: ReportMeta) {
  return meta.dateFrom === meta.dateTo
    ? `attendance-${meta.dateFrom}`
    : `attendance-${meta.dateFrom}-to-${meta.dateTo}`;
}

export function exportCsv(rows: AttendanceRecord[], meta: ReportMeta) {
  const escape = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [HEADERS, ...rows.map(rowValues)].map((cols) => cols.map(escape).join(","));
  // BOM so Excel opens UTF-8 (e.g. "ñ" in names) correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${fileBase(meta)}.csv`);
}

export async function exportXlsx(rows: AttendanceRecord[], meta: ReportMeta) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = HEADERS.map((value) => ({ value, fontWeight: "bold" as const }));
  const data = rows.map((r) =>
    rowValues(r).map((value, i) =>
      typeof value === "number"
        ? { value, type: Number, format: i >= 8 ? "0.00" : "0" }
        : { value: value ?? "", type: String }
    )
  );
  const blob = await writeXlsxFile([header, ...data], {
    sheet: "Attendance",
    columns: [{ width: 12 }, { width: 28 }, { width: 26 }, { width: 22 }, { width: 11 }, { width: 12 }, { width: 12 }, { width: 13 }, { width: 14 }, { width: 15 }],
    stickyRowsCount: 1,
  }).toBlob();
  downloadBlob(blob, `${fileBase(meta)}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Opens a print-ready DTR / attendance report. Returns false if pop-ups are blocked. */
export function printReport(rows: AttendanceRecord[], meta: ReportMeta): boolean {
  const w = window.open("", "_blank", "width=1000,height=760");
  if (!w) return false;

  const range =
    meta.dateFrom === meta.dateTo
      ? formatDate(meta.dateFrom, "long")
      : `${formatDate(meta.dateFrom, "long")} – ${formatDate(meta.dateTo, "long")}`;
  const filters = [meta.status && `Status: ${meta.status}`, meta.search && `Search: “${meta.search}”`].filter(Boolean).join(" · ");

  const body = rows
    .map(
      (r) => `<tr>
        <td>${esc(formatDate(r.Date))}</td>
        <td><strong>${esc(r.FullName ?? "")}</strong><br><span class="muted">${esc(r.EmployeeID)}</span></td>
        <td>${esc(r.Department ?? "")}</td>
        <td>${esc(formatTime(r.TimeIn) || "—")}</td>
        <td>${esc(timeOutText(r) || "—")}</td>
        <td>${esc(r.Status)}</td>
        <td class="num">${toNumber(r.LateMinutes) ?? "—"}</td>
        <td class="num">${formatHours(r.TotalHours)}</td>
        <td class="num">${formatHours(r.OvertimeHours)}</td>
      </tr>`
    )
    .join("");

  w.document.write(`<!doctype html><html><head><title>Attendance Report</title><style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1a1f1a; font-size: 11.5px; margin: 0; padding: 24px; }
    .head { text-align: center; margin-bottom: 14px; }
    .rep { font-size: 11px; letter-spacing: .12em; }
    .org { font-size: 16px; font-weight: 700; margin: 3px 0; text-transform: uppercase; }
    .title { font-size: 13px; font-weight: 700; letter-spacing: .04em; color: #14532d; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 28px; border-top: 2px solid #14532d; border-bottom: 1px solid #d1d5db; padding: 8px 0; margin-bottom: 12px; }
    .meta b { color: #374151; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f5f1; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #374151; }
    th, td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; }
    tr { break-inside: avoid; }
    .num { text-align: right; }
    .muted { color: #6b7280; font-size: 10px; }
    .count { margin-top: 6px; color: #6b7280; }
    .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; break-inside: avoid; }
    .sign div { flex: 1; max-width: 300px; }
    .line { border-top: 1px solid #111; margin-top: 44px; padding-top: 4px; text-align: center; font-weight: 600; }
    .empty { text-align: center; padding: 24px; color: #6b7280; }
  </style></head><body>
    <div class="head">
      <div class="rep">REPUBLIC OF THE PHILIPPINES</div>
      <div class="org">${esc(meta.orgName || "Local Government Unit")}</div>
      <div class="title">DAILY TIME RECORD / ATTENDANCE REPORT</div>
    </div>
    <div class="meta">
      <span><b>Date Range:</b> ${esc(range)}</span>
      <span><b>Department:</b> ${esc(meta.department || "All Departments")}</span>
      <span><b>Generated:</b> ${esc(formatDate(manilaToday(), "long"))}</span>
      ${filters ? `<span><b>Filters:</b> ${esc(filters)}</span>` : ""}
    </div>
    <table>
      <thead><tr><th>Date</th><th>Employee</th><th>Department</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Late (min)</th><th>Work Hrs</th><th>OT Hrs</th></tr></thead>
      <tbody>${body || `<tr><td colspan="9" class="empty">No attendance records for the selected filters.</td></tr>`}</tbody>
    </table>
    <div class="count">${rows.length} record${rows.length === 1 ? "" : "s"}</div>
    <div class="sign">
      <div>Prepared by:<div class="line">HR/Admin Officer</div></div>
      <div>Certified Correct:<div class="line">Department Head</div></div>
    </div>
  </body></html>`);
  w.document.close();
  w.focus();
  // Give the new window a moment to lay out before opening the print dialog.
  setTimeout(() => w.print(), 300);
  return true;
}
