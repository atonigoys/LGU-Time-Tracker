import type { LucideIcon } from "lucide-react";

const TONE_STYLES: Record<string, { border: string; iconBg: string; iconFg: string }> = {
  default: { border: "border-t-green-600", iconBg: "bg-green-50", iconFg: "text-green-700" },
  warn: { border: "border-t-amber-500", iconBg: "bg-amber-50", iconFg: "text-amber-600" },
  danger: { border: "border-t-red-600", iconBg: "bg-red-50", iconFg: "text-red-600" },
  gold: { border: "border-t-amber-400", iconBg: "bg-amber-50", iconFg: "text-amber-500" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: "default" | "warn" | "danger" | "gold";
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className={`rounded-xl border-t-4 bg-white p-4 shadow-sm ${t.border}`}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${t.iconBg} ${t.iconFg}`}>
            <Icon size={14} strokeWidth={2.3} />
          </div>
        )}
      </div>
      <div className="mt-1 text-3xl font-bold text-green-800 [font-variant-numeric:proportional-nums]">{value}</div>
    </div>
  );
}
