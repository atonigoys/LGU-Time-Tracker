/**
 * Display formatting for attendance data. The backend stores ISO dates
 * ("yyyy-MM-dd") and returns times already converted to Asia/Manila, so
 * nothing here depends on the browser's timezone except manilaToday().
 */

export const PH_TIMEZONE = "Asia/Manila";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Today's date in Manila as "yyyy-MM-dd", regardless of the device timezone. */
export function manilaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA formats as yyyy-MM-dd
}

/** Shifts a "yyyy-MM-dd" date by whole days (calendar math, no timezone drift). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function parseIso(iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "2026-09-23" -> "Sep 23, 2026" (compact) or "September 23, 2026" (long). */
export function formatDate(iso?: string, style: "compact" | "long" = "compact"): string {
  const p = parseIso(iso);
  if (!p || p.m < 1 || p.m > 12) return "—";
  const month = style === "long" ? MONTHS[p.m - 1] : MONTHS[p.m - 1].slice(0, 3);
  return `${month} ${p.d}, ${p.y}`;
}

/** "2026-09-23" -> "Wed" */
export function weekdayShort(iso?: string): string {
  const p = parseIso(iso);
  if (!p) return "";
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

/**
 * "11:29:57 AM" -> "11:29 AM" (seconds hidden) or unchanged with seconds.
 * Also accepts "HH:mm" 24-hour strings. Returns "" for anything unreadable.
 */
export function formatTime(value?: string, withSeconds = false): string {
  const v = (value ?? "").trim();
  const twelve = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/.exec(v);
  if (twelve) {
    const h = twelve[1].padStart(2, "0");
    const sec = withSeconds && twelve[3] ? `:${twelve[3]}` : "";
    return `${h}:${twelve[2]}${sec} ${twelve[4].toUpperCase()}`;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (twentyFour) {
    const H = Number(twentyFour[1]);
    if (H > 23) return "";
    const h12 = String(((H + 11) % 12) + 1).padStart(2, "0");
    const sec = withSeconds && twentyFour[3] ? `:${twentyFour[3]}` : "";
    return `${h12}:${twentyFour[2]}${sec} ${H < 12 ? "AM" : "PM"}`;
  }
  return "";
}

/** A finite number, or null. Guards against "", "#NUM!", NaN, Infinity from any source. */
export function toNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 8 -> "8.00", with a fallback for missing/invalid values. */
export function formatHours(value: unknown, fallback = "—"): string {
  const n = toNumber(value);
  return n === null ? fallback : n.toFixed(2);
}

/** "yyyy-MM-dd hh:mm:ss a" (CreatedAt) -> "September 23, 2026, 11:29 AM" */
export function formatDateTime(value?: string): string {
  const v = (value ?? "").trim();
  const date = formatDate(v, "long");
  if (date === "—") return "—";
  const time = formatTime(v.slice(11));
  return time ? `${date}, ${time}` : date;
}
