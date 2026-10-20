"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import type { GenericPoint } from "@/lib/dataset";

export function GenericTrendChart({
  title,
  points,
  selected = false,
  onInspect,
}: {
  title: string;
  points: GenericPoint[];
  selected?: boolean;
  onInspect?: () => void;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card p-5 text-sm text-muted">
        Need a date column and at least two periods to draw a trend.
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onInspect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onInspect?.();
      }}
      className={`w-full rounded-lg border bg-card p-5 text-left ${
        selected ? "border-navy" : "border-border"
      }`}
    >
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-[11px] text-muted">Click for a second opinion on this trend.</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} width={52} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1b365d" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GenericBreakdownChart({
  title,
  points,
  selected = false,
  onInspect,
}: {
  title: string;
  points: GenericPoint[];
  selected?: boolean;
  onInspect?: () => void;
}) {
  if (points.length === 0) {
    return (
      <Card className="flex h-72 items-center justify-center p-5 text-sm text-muted">
        Pick a category column to see a breakdown.
      </Card>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onInspect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onInspect?.();
      }}
      className={`w-full rounded-lg border bg-card p-5 text-left ${
        selected ? "border-navy" : "border-border"
      }`}
    >
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-[11px] text-muted">Click for a second opinion on this breakdown.</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={88} tick={{ fill: "#64748B", fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1b365d" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
