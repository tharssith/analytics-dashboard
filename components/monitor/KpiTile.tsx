"use client";

import { ChevronDown } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { StatusDot } from "@/components/ui/StatusDot";
import type { KpiTileModel, RagStatus } from "@/lib/types";

const STROKE: Record<RagStatus | "neutral", string> = {
  green: "#5B8A72",
  amber: "#C4923A",
  red: "#C45C5C",
  neutral: "#94A3B8",
};

const SURFACE: Record<RagStatus | "neutral", string> = {
  green: "bg-rag-green-bg",
  amber: "bg-rag-amber-bg",
  red: "bg-rag-red-bg",
  neutral: "bg-slate-100",
};

export function KpiTile({
  tile,
  expanded,
  onToggle,
}: {
  tile: KpiTileModel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const interactive = tile.expandable;
  const className = [
    "flex w-full flex-col gap-3 p-4 text-left transition-colors",
    interactive ? "cursor-pointer hover:bg-background/80" : "cursor-default",
  ].join(" ");

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusDot status={tile.status} />
          <p className="text-xs font-medium text-muted">{tile.label}</p>
        </div>
        {interactive ? (
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        ) : null}
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {tile.display}
        </p>
        <p className="mt-1 text-xs text-muted">{tile.context}</p>
      </div>

      <div className={`-mx-1 h-10 rounded ${SURFACE[tile.status]}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={tile.sparkline}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <Line
              type="monotone"
              dataKey="value"
              stroke={STROKE[tile.status]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  if (!interactive) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {body}
    </button>
  );
}
