"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DiagnoseModel } from "@/lib/diagnose";
import type { Department, DepartmentFilter, RagStatus } from "@/lib/types";

const FILL: Record<RagStatus | "neutral", string> = {
  green: "#5B8A72",
  amber: "#C4923A",
  red: "#C45C5C",
  neutral: "#94A3B8",
};

const FILL_SELECTED: Record<RagStatus | "neutral", string> = {
  green: "#4A7460",
  amber: "#A87A2E",
  red: "#A84A4A",
  neutral: "#64748B",
};

const NAVY = "#1B365D";

export function DepartmentBreakdownChart({
  model,
  selectedDepartment = "All",
  onDepartmentClick,
}: {
  model: DiagnoseModel;
  selectedDepartment?: DepartmentFilter;
  onDepartmentClick?: (department: Department) => void;
}) {
  const interactive = Boolean(onDepartmentClick);
  const [hovered, setHovered] = useState<Department | null>(null);

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={model.bars}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="department"
            tick={{ fill: "#64748B", fontSize: 12 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(27, 54, 93, 0.06)" }}
            contentStyle={{
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [
              typeof value === "number"
                ? value.toLocaleString("en-US", {
                    maximumFractionDigits: 1,
                  })
                : value,
              model.barLabel,
            ]}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            cursor={interactive ? "pointer" : "default"}
            onClick={(data) => {
              const department = (data?.payload as { department?: Department } | undefined)
                ?.department;
              if (department && onDepartmentClick) onDepartmentClick(department);
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {model.bars.map((bar) => {
              const selected = selectedDepartment === bar.department;
              const isHovered = interactive && hovered === bar.department;
              return (
                <Cell
                  key={bar.department}
                  fill={
                    selected || isHovered
                      ? FILL_SELECTED[bar.status]
                      : FILL[bar.status]
                  }
                  stroke={selected ? NAVY : "transparent"}
                  strokeWidth={selected ? 1.5 : 0}
                  onMouseEnter={() => {
                    if (interactive) setHovered(bar.department);
                  }}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DiagnosePanel({
  open,
  model,
}: {
  open: boolean;
  model: DiagnoseModel | null;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">
        {model ? (
          <div className="border-t border-border px-4 py-4">
            <p className="text-xs font-medium text-muted">Variance vs target</p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {model.varianceSentence}
            </p>
            {model.monthLabel ? (
              <p className="mt-1 text-xs text-muted">{model.monthLabel}</p>
            ) : null}

            {model.showBreakdown ? (
              <div className="mt-4">
                <p className="mb-3 text-xs font-medium text-muted">
                  Department breakdown
                </p>
                <DepartmentBreakdownChart model={model} />
                {model.contributorSentence ? (
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {model.contributorSentence}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
