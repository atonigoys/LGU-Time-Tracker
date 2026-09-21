"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DepartmentPoint {
  department: string;
  count: number;
}

const BAR_COLOR = "#15803d";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: DepartmentPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] shadow-md">
      <div className="font-semibold text-gray-900">{p.department}</div>
      <div className="text-gray-600">{p.count} attendance record(s)</div>
    </div>
  );
}

export function DepartmentChart({ data }: { data: DepartmentPoint[] }) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  const hasData = sorted.some((d) => d.count > 0);
  const maxCount = Math.max(1, ...sorted.map((d) => d.count));

  if (!hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13.5px] text-gray-400">
        No department data for this period yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 34)}>
      <BarChart
        data={sorted}
        layout="vertical"
        barCategoryGap="26%"
        margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke="#e1e0d9" />
        <XAxis type="number" allowDecimals={false} hide domain={[0, maxCount]} />
        <YAxis
          type="category"
          dataKey="department"
          axisLine={false}
          tickLine={false}
          width={150}
          tick={{ fontSize: 12, fill: "#52514e" }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Bar
          dataKey="count"
          fill={BAR_COLOR}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          label={{ position: "right", fontSize: 11.5, fill: "#52514e" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
