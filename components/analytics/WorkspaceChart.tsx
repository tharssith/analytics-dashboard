"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { VISUAL_PALETTE, type VisualKind, type VizResult } from "@/lib/analysis-workspace";

export function WorkspaceChart({
  visual,
  viz,
  showLabels,
}: {
  visual: VisualKind;
  viz: VizResult;
  showLabels: boolean;
}) {
  if (visual === "card") {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{viz.title}</p>
        <p className="mt-3 text-5xl font-semibold tabular-nums text-navy">
          {viz.total.toLocaleString("en-US", { maximumFractionDigits: 1 })}
        </p>
        <p className="mt-2 text-sm text-muted">{viz.rowCount.toLocaleString("en-US")} rows in this view</p>
      </div>
    );
  }

  if (viz.points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Drop a dimension on Columns and a measure on Values to draw this visual.
      </div>
    );
  }

  if (visual === "table") {
    return (
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-[#eee]">
              <th className="px-3 py-2 text-xs font-semibold text-muted">Category</th>
              {viz.seriesKeys.map((key) => (
                <th key={key} className="px-3 py-2 text-xs font-semibold text-muted">
                  {key}
                </th>
              ))}
              <th className="px-3 py-2 text-xs font-semibold text-muted">Total</th>
            </tr>
          </thead>
          <tbody>
            {viz.points.map((point) => (
              <tr key={point.label} className="border-b border-border/80">
                <td className="px-3 py-1.5">{point.label}</td>
                {viz.seriesKeys.map((key) => (
                  <td key={key} className="px-3 py-1.5 tabular-nums">
                    {Number(point[key] ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 })}
                  </td>
                ))}
                <td className="px-3 py-1.5 tabular-nums font-medium">
                  {point.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (visual === "pie" || visual === "donut") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={viz.points}
            dataKey="value"
            nameKey="label"
            innerRadius={visual === "donut" ? "52%" : 0}
            outerRadius="78%"
            label={showLabels}
          >
            {viz.points.map((point, index) => (
              <Cell key={point.label} fill={VISUAL_PALETTE[index % VISUAL_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (visual === "treemap") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={viz.points.map((point) => ({ name: point.label, size: point.value }))}
          dataKey="size"
          stroke="#fff"
          fill="#1b365d"
        />
      </ResponsiveContainer>
    );
  }

  const layout = visual === "bar" || visual === "map" ? "vertical" : "horizontal";
  const Chart = visual === "line" ? LineChart : visual === "area" ? AreaChart : BarChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={viz.points} layout={layout === "vertical" ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="#E2E8F0" vertical={layout !== "vertical"} horizontal={layout === "vertical"} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={96} tick={{ fill: "#64748B", fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
          </>
        )}
        <Tooltip />
        {viz.seriesKeys.map((key, index) => {
          const color = VISUAL_PALETTE[index % VISUAL_PALETTE.length];
          if (visual === "line") {
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                label={showLabels ? { fontSize: 10 } : undefined}
              />
            );
          }
          if (visual === "area") {
            return <Area key={key} type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.25} />;
          }
          return (
            <Bar
              key={key}
              dataKey={key}
              fill={color}
              radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              label={showLabels ? { fontSize: 10, fill: "#1e293b" } : undefined}
            />
          );
        })}
      </Chart>
    </ResponsiveContainer>
  );
}
