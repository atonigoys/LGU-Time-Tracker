const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-800 ring-green-600/20",
  LATE: "bg-amber-50 text-amber-800 ring-amber-600/25",
  ABSENT: "bg-red-50 text-red-700 ring-red-600/20",
  INCOMPLETE: "bg-orange-50 text-orange-800 ring-orange-600/20",
  "ON LEAVE": "bg-sky-50 text-sky-800 ring-sky-600/20",
  HOLIDAY: "bg-violet-50 text-violet-800 ring-violet-600/20",
  "DAY OFF": "bg-gray-100 text-gray-700 ring-gray-500/20",
  "OFFICIAL BUSINESS": "bg-teal-50 text-teal-800 ring-teal-600/20",
};

export function StatusBadge({ status }: { status?: string }) {
  const cls = STATUS_STYLES[status ?? ""] ?? "bg-gray-50 text-gray-600 ring-gray-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap ring-1 ring-inset ${cls}`}
    >
      {status || "—"}
    </span>
  );
}

const PILL_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
};

export function StatusPill({ status }: { status: string }) {
  const cls = PILL_STYLES[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${cls}`}>{status}</span>;
}
