"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface WeeklyPoint {
  day: string;
  present: number;
  late: number;
}

const PRESENT_COLOR = "#15803d";
const LATE_COLOR = "#d97706";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const present = payload.find((p) => p.dataKey === "present")?.value ?? 0;
  const late = payload.find((p) => p.dataKey === "late")?.value ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] shadow-md">
      <div className="mb-1 font-semibold text-gray-900">{label}</div>
      <div className="flex items-center gap-1.5 text-gray-600">
        <span className="h-2 w-2 rounded-full" style={{ background: PRESENT_COLOR }} /> Present: {present}
      </div>
      <div className="flex items-center gap-1.5 text-gray-600">
        <span className="h-2 w-2 rounded-full" style={{ background: LATE_COLOR }} /> Late: {late}
      </div>
    </div>
  );
}

export function WeeklyAttendanceChart({ data }: { data: WeeklyPoint[] }) {
  const hasData = data.some((d) => d.present + d.late > 0);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[12px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: PRESENT_COLOR }} /> Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: LATE_COLOR }} /> Late
        </span>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#e1e0d9" strokeDasharray="0" />
            <XAxis
              dataKey="day"
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              tick={{ fontSize: 11.5, fill: "#898781" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11.5, fill: "#898781" }}
              width={28}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="present" stackId="a" fill={PRESENT_COLOR} maxBarSize={24} stroke="#fff" strokeWidth={2} />
            <Bar
              dataKey="late"
              stackId="a"
              fill={LATE_COLOR}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              stroke="#fff"
              strokeWidth={2}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-[13.5px] text-gray-400">
          No attendance recorded this week yet.
        </div>
      )}
    </div>
  );
}
