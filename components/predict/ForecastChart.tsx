"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { forecastHeadcount } from "@/lib/forecast";
import type { MonthlyPoint } from "@/lib/types";

export function ForecastChart({ series }: { series: MonthlyPoint[] }) {
  const forecast = forecastHeadcount(series);

  if (!forecast) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card p-5 text-sm text-muted">
        Need at least three months in the current filter to draw a trend line.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          Headcount outlook
        </h2>
        <p className="mt-1 text-xs text-muted">
          Six-month trend line with a 95% prediction band that widens further out.
        </p>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={forecast.points}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={["dataMin - 8", "dataMax + 8"]}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (value == null || typeof value !== "number") return ["—", String(name)];
                const label =
                  name === "actual"
                    ? "Actual"
                    : name === "forecast"
                      ? "Trend"
                      : name === "range"
                        ? "Band width"
                        : String(name);
                return [
                  value.toLocaleString("en-US", { maximumFractionDigits: 1 }),
                  label,
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="range"
              stackId="band"
              stroke="none"
              fill="#1B365D"
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#1B365D"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#1B365D"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
