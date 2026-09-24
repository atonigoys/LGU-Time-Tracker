import { formatDate, formatTime } from "@/lib/format";

export type AuditValue = string | number | boolean | Record<string, unknown> | unknown[] | "";

export interface AuditEntry {
  LogID: string;
  /** "yyyy-MM-dd HH:mm:ss" Philippine time */
  Timestamp: string;
  UserID: string;
  UserName: string;
  UserRole: string;
  Action: string;
  Target: string;
  TargetName: string;
  OldValue: AuditValue;
  NewValue: AuditValue;
}

export type AuditCategory = "auth" | "attendance" | "employee" | "config" | "security" | "system";

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: "Sign-in",
  attendance: "Attendance",
  employee: "Employees",
  config: "Configuration",
  security: "Security",
  system: "System",
};

export const CATEGORY_STYLES: Record<AuditCategory, string> = {
  auth: "bg-sky-50 text-sky-800 ring-sky-600/20",
  attendance: "bg-green-50 text-green-800 ring-green-600/20",
  employee: "bg-violet-50 text-violet-800 ring-violet-600/20",
  config: "bg-gray-100 text-gray-700 ring-gray-500/20",
  security: "bg-amber-50 text-amber-800 ring-amber-600/25",
  system: "bg-red-50 text-red-700 ring-red-600/20",
};

const ACTIONS: Record<string, { label: string; category: AuditCategory }> = {
  LOGIN: { label: "Signed in", category: "auth" },
  LOGIN_FAILED: { label: "Failed sign-in", category: "security" },
  CHANGE_PASSWORD: { label: "Changed password", category: "security" },
  RESET_PASSWORD: { label: "Reset password", category: "security" },
  REGENERATE_QR: { label: "Issued new QR code", category: "security" },
  TIME_IN: { label: "Time in", category: "attendance" },
  TIME_OUT: { label: "Time out", category: "attendance" },
  CREATE_ATTENDANCE: { label: "Added attendance", category: "attendance" },
  UPDATE_ATTENDANCE: { label: "Edited attendance", category: "attendance" },
  DELETE_ATTENDANCE: { label: "Deleted attendance", category: "attendance" },
  CREATE_EMPLOYEE: { label: "Created employee", category: "employee" },
  UPDATE_EMPLOYEE: { label: "Updated employee", category: "employee" },
  ACTIVATE_EMPLOYEE: { label: "Activated employee", category: "employee" },
  DEACTIVATE_EMPLOYEE: { label: "Deactivated employee", category: "employee" },
  APPROVE_EMPLOYEE: { label: "Approved account", category: "employee" },
  REJECT_EMPLOYEE: { label: "Rejected account", category: "employee" },
  SELF_REGISTER: { label: "Registered account", category: "employee" },
  UPDATE_PROFILE_PHOTO: { label: "Updated profile photo", category: "employee" },
  UPDATE_SETTING: { label: "Changed setting", category: "config" },
  CREATE_SCHEDULE: { label: "Created schedule", category: "config" },
  UPDATE_SCHEDULE: { label: "Updated schedule", category: "config" },
  CREATE_HOLIDAY: { label: "Added holiday", category: "config" },
  UPDATE_HOLIDAY: { label: "Updated holiday", category: "config" },
  DELETE_HOLIDAY: { label: "Deleted holiday", category: "config" },
  CREATE_DEPARTMENT: { label: "Added department", category: "config" },
  UPDATE_DEPARTMENT: { label: "Updated department", category: "config" },
  REQUEST_LEAVE: { label: "Requested leave", category: "employee" },
  UPDATE_LEAVE_STATUS: { label: "Reviewed leave", category: "employee" },
  RESET_ALL_ACCOUNTS: { label: "Reset all accounts", category: "system" },
  REMOVE_DEMO_ACCOUNTS: { label: "Removed demo accounts", category: "system" },
};

export function actionMeta(action: string) {
  return (
    ACTIONS[action] ?? {
      label: action
        .toLowerCase()
        .split("_")
        .map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
        .join(" "),
      category: "config" as AuditCategory,
    }
  );
}

const FIELD_LABELS: Record<string, string> = {
  FullName: "Name",
  EmployeeID: "Employee ID",
  TimeIn: "Time In",
  TimeOut: "Time Out",
  LateMinutes: "Late (min)",
  TotalHours: "Work hours",
  OvertimeHours: "OT hours",
  HolidayName: "Holiday",
  ScheduleName: "Schedule",
  StartTime: "Start",
  EndTime: "End",
  LunchStart: "Lunch start",
  LunchEnd: "Lunch end",
  GraceMinutes: "Grace (min)",
  DepartmentName: "Department",
  DepartmentHead: "Department head",
  LeaveType: "Leave type",
  StartDate: "Start date",
  EndDate: "End date",
  PhotoURL: "Photo",
  DateCreated: "Created",
  CreatedAt: "Created",
  UpdatedAt: "Updated",
  AttendanceID: "Record ID",
  Device: "Source",
};

// Bookkeeping fields that add noise to summaries (still shown in the detail view).
const NOISY = new Set(["UpdatedAt", "CreatedAt", "AttendanceID", "IP", "Device", "LogID", "HolidayID", "ScheduleID", "DepartmentID", "LeaveID"]);

export const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k.replace(/([a-z])([A-Z])/g, "$1 $2");

export const asObject = (v: AuditValue): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Human-readable value: PH datetimes shortened, blanks shown as an em dash. */
export function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  const dt = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2}(?::\d{2})? ?[AP]M)$/i.exec(s);
  if (dt) return `${formatDate(dt[1])}, ${formatTime(dt[2])}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(s);
  if (/^https?:\/\//.test(s)) return "Link";
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

const timeOf = (v: unknown) => {
  const s = String(v ?? "");
  const m = /(\d{1,2}:\d{2}(?::\d{2})? ?[AP]M)$/i.exec(s);
  return m ? formatTime(m[1]) : "";
};

/** Fields whose value differs between before and after (after may be a partial patch). */
export function changedFields(entry: AuditEntry): Array<{ key: string; before: unknown; after: unknown }> {
  const o = asObject(entry.OldValue);
  const n = asObject(entry.NewValue);
  const keys = Object.keys(n).length ? Object.keys(n) : Object.keys(o);
  return keys
    .filter((k) => k !== "Reason" && String(o[k] ?? "") !== String(n[k] ?? ""))
    .map((k) => ({ key: k, before: o[k], after: n[k] }));
}

/** One-line description of what happened, built only from the logged values. */
export function summarize(e: AuditEntry): string {
  const o = asObject(e.OldValue);
  const n = asObject(e.NewValue);
  const reason = n.Reason ? ` · Reason: “${String(n.Reason)}”` : "";
  switch (e.Action) {
    case "LOGIN":
      return "Signed in to the system";
    case "LOGIN_FAILED":
      return `Unsuccessful sign-in attempt${e.Target ? ` for ${e.Target}` : ""}`;
    case "CHANGE_PASSWORD":
      return "Changed their own password";
    case "RESET_PASSWORD":
      return "Issued a temporary password";
    case "REGENERATE_QR":
      return "Issued a new attendance QR code; the old one no longer works";
    case "TIME_IN": {
      const t = timeOf(n.TimeIn);
      const late = Number(n.LateMinutes) > 0 ? ` · Late ${n.LateMinutes} min` : "";
      return `Timed in${t ? ` at ${t}` : ""}${late}`;
    }
    case "TIME_OUT": {
      const t = timeOf(n.TimeOut);
      const hrs = n.TotalHours !== undefined && n.TotalHours !== "" ? ` · ${Number(n.TotalHours).toFixed(2)} hrs` : "";
      return `Timed out${t ? ` at ${t}` : ""}${hrs}`;
    }
    case "CREATE_ATTENDANCE": {
      const date = n.Date ? formatDate(String(n.Date)) : "";
      const parts = [n.TimeIn && `In ${n.TimeIn}`, n.TimeOut && `Out ${n.TimeOut}`].filter(Boolean).join(", ");
      return `${date}${parts ? `: ${parts}` : ""}${reason}`;
    }
    case "UPDATE_ATTENDANCE": {
      const date = n.Date ? `${formatDate(String(n.Date))}: ` : "";
      const diffs = (["TimeIn", "TimeOut"] as const)
        .filter((k) => String(o[k] ?? "") !== String(n[k] ?? ""))
        .map((k) => `${fieldLabel(k)} ${displayValue(o[k])} → ${displayValue(n[k])}`);
      return `${date}${diffs.length ? diffs.join(", ") : "No time changes"}${reason}`;
    }
    case "DELETE_ATTENDANCE":
      return `Deleted the record for ${o.Date ? formatDate(String(o.Date)) : "a day"}${reason}`;
    case "UPDATE_SETTING": {
      const before = typeof e.OldValue === "string" ? e.OldValue : "";
      const after = typeof e.NewValue === "string" ? e.NewValue : "";
      const name = fieldLabel(e.Target.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
      if (!after) return `${name} cleared`;
      return before ? `${name}: “${displayValue(before)}” → “${displayValue(after)}”` : `${name} set to “${displayValue(after)}”`;
    }
    case "SELF_REGISTER":
      return `New self-registration${n.Department ? ` for ${n.Department}` : ""}, awaiting approval`;
    case "CREATE_EMPLOYEE":
      return [n.FullName, n.Role, n.Department].filter(Boolean).join(" · ");
    case "UPDATE_PROFILE_PHOTO":
      return "Uploaded a new profile photo";
    case "CREATE_HOLIDAY":
    case "DELETE_HOLIDAY": {
      const h = e.Action === "DELETE_HOLIDAY" ? o : n;
      return [h.HolidayName, h.Date && formatDate(String(h.Date)), h.Type].filter(Boolean).join(" · ");
    }
    case "CREATE_SCHEDULE":
      return [n.ScheduleName, n.StartTime && n.EndTime && `${formatTime(String(n.StartTime))} – ${formatTime(String(n.EndTime))}`].filter(Boolean).join(" · ");
    case "CREATE_DEPARTMENT":
      return String(n.DepartmentName ?? "");
    case "REQUEST_LEAVE":
      return [n.LeaveType, n.StartDate && `${formatDate(String(n.StartDate))}${n.EndDate && n.EndDate !== n.StartDate ? ` – ${formatDate(String(n.EndDate))}` : ""}`]
        .filter(Boolean)
        .join(" · ");
    case "RESET_ALL_ACCOUNTS":
      return `Deleted ${n.Employees ?? 0} account(s), ${n.Attendance ?? 0} attendance and ${n.Leave ?? 0} leave record(s)`;
    case "REMOVE_DEMO_ACCOUNTS":
      return `Removed ${n.employees ?? 0} demo account(s)`;
  }
  const changes = changedFields(e).filter((c) => !NOISY.has(c.key));
  if (changes.length) {
    const shown = changes.slice(0, 3).map((c) => `${fieldLabel(c.key)}: ${displayValue(c.before)} → ${displayValue(c.after)}`);
    return shown.join(" · ") + (changes.length > 3 ? ` · +${changes.length - 3} more` : "");
  }
  return "";
}

/** "2026-09-23 16:25:49" -> { date: "Sep 23, 2026", time: "04:25:49 PM" } */
export function splitTimestamp(ts: string) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(ts);
  if (!m) return { date: "—", time: "", iso: "" };
  return { date: formatDate(m[1]), time: formatTime(m[2], true), iso: m[1] };
}
