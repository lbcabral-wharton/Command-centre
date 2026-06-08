"use client";

import { PieChart, Pie, Cell } from "recharts";

export type DonutSlice = { label: string; value: number; color: string };

// Fixed-size donut (no ResponsiveContainer) with a centered total label.
export function OverviewDonut({
  data,
  total,
  centerLabel,
  size = 200,
}: {
  data: DonutSlice[];
  total: number;
  centerLabel: string;
  size?: number;
}) {
  const slices = data.filter((d) => d.value > 0);
  const inner = size * 0.31;
  const outer = size * 0.45;

  if (slices.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        No data yet
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={inner}
          outerRadius={outer}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {slices.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-semibold tabular-nums text-foreground">
          {total}
        </span>
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}
