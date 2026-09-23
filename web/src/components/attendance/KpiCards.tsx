import type { LucideIcon } from "lucide-react";
import { Clock, Timer, UserCheck, Users, UserX } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";

const TONES = {
  neutral: { icon: "bg-green-50 text-green-800", value: "text-green-950" },
  green: { icon: "bg-green-50 text-green-700", value: "text-green-800" },
  amber: { icon: "bg-amber-50 text-amber-700", value: "text-amber-700" },
  red: { icon: "bg-red-50 text-red-600", value: "text-red-700" },
  blue: { icon: "bg-indigo-50 text-indigo-600", value: "text-indigo-700" },
} as const;

function KpiCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={`min-w-0 rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,16,0.04)] ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11.5px] font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon size={16} strokeWidth={2.2} aria-hidden />
        </div>
      </div>
      <div className={`mt-1.5 text-[28px] leading-none font-bold tracking-tight tabular-nums ${t.value}`}>
        {value}
        {unit && <span className="ml-1 text-[15px] font-semibold text-gray-500">{unit}</span>}
      </div>
      <div className="mt-2 truncate text-[12.5px] text-gray-500">{detail}</div>
    </div>
  );
}

// Grid placement for the 5 cards: phones (2 cols) give Total a full row;
// tablets (6 cols) show 3 + 2; wide screens (5 cols) show one row.
const SPANS = [
  "col-span-2 sm:col-span-2 xl:col-span-1",
  "sm:col-span-2 xl:col-span-1",
  "sm:col-span-2 xl:col-span-1",
  "sm:col-span-3 xl:col-span-1",
  "col-span-2 sm:col-span-3 xl:col-span-1",
];

export interface KpiValues {
  totalEmployees: number;
  attended: number;
  late: number;
  absent: number;
  overtimeHours: number;
  /** attended / (attended + absent), or null when no working days are in range */
  attendanceRate: number | null;
}

export function KpiCards({ values, periodLabel }: { values: KpiValues | null; periodLabel: string }) {
  if (!values) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`rounded-xl border border-gray-200/80 bg-white p-4 ${SPANS[i]}`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2.5 h-3 w-28" />
          </div>
        ))}
      </>
    );
  }
  const rate = values.attendanceRate;
  return (
    <>
      <KpiCard label="Total Employees" value={String(values.totalEmployees)} detail="Active registered employees" icon={Users} tone="neutral" className={SPANS[0]} />
      <KpiCard
        label="Present"
        value={String(values.attended)}
        detail={rate === null ? periodLabel : `${(rate * 100).toFixed(1)}% attendance rate`}
        icon={UserCheck}
        tone="green"
        className={SPANS[1]}
      />
      <KpiCard label="Late" value={String(values.late)} detail={periodLabel} icon={Clock} tone="amber" className={SPANS[2]} />
      <KpiCard label="Absent" value={String(values.absent)} detail={periodLabel} icon={UserX} tone="red" className={SPANS[3]} />
      <KpiCard
        label="Overtime"
        value={values.overtimeHours.toFixed(values.overtimeHours % 1 === 0 ? 0 : 1)}
        unit="hrs"
        detail={periodLabel}
        icon={Timer}
        tone="blue"
        className={SPANS[4]}
      />
    </>
  );
}
