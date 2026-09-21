const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status?: string }) {
  const cls = STATUS_STYLES[status ?? ""] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${cls}`}>
      {status || "-"}
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
