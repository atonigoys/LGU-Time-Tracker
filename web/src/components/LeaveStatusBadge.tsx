import type { LeaveStatus } from "@/lib/types";

const STYLES: Record<LeaveStatus, string> = {
  Pending: "bg-amber-50 text-amber-800 ring-amber-600/25",
  Approved: "bg-green-50 text-green-800 ring-green-600/20",
  Rejected: "bg-red-50 text-red-700 ring-red-600/20",
  Cancelled: "bg-gray-100 text-gray-600 ring-gray-400/30",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus | string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase ring-1 ring-inset ${
        STYLES[status as LeaveStatus] ?? STYLES.Cancelled
      }`}
    >
      {status}
    </span>
  );
}
