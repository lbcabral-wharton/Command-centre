"use client";

import { LineChart, Line, YAxis } from "recharts";

type SparklineProps = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
};

// Tiny inline trend line for a single instrument. Fixed-size (no
// ResponsiveContainer) so it renders reliably inside a table cell.
export function Sparkline({
  data,
  positive = true,
  width = 80,
  height = 28,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-muted-foreground/40 text-xs"
      >
        —
      </div>
    );
  }

  const chartData = data.map((v, i) => ({ i, v }));
  const color = positive ? "#059669" : "#dc2626"; // emerald-600 / red-600

  return (
    <LineChart
      width={width}
      height={height}
      data={chartData}
      margin={{ top: 4, right: 2, bottom: 4, left: 2 }}
    >
      <YAxis hide domain={["dataMin", "dataMax"]} />
      <Line
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
