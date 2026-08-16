"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, X } from "lucide-react";
import { DEPARTMENTS, dataset, uniqueMonths } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import type { DepartmentFilter } from "@/lib/types";

const selectClass =
  "h-9 rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 focus:border-navy";

export function FilterBar({
  actionHref,
  actionLabel,
  actionIcon = "forward",
}: {
  actionHref: string;
  actionLabel: string;
  actionIcon?: "forward" | "back";
}) {
  const { filters, setFilters, setDepartment } = useFilters();
  const months = uniqueMonths();
  const clickFiltered = filters.department !== "All";

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex min-w-[140px] flex-col gap-1.5 text-xs font-medium text-muted">
        From
        <select
          value={filters.startMonth}
          onChange={(event) => {
            const startMonth = event.target.value;
            setFilters({
              ...filters,
              startMonth,
              endMonth:
                startMonth > filters.endMonth ? startMonth : filters.endMonth,
            });
          }}
          className={selectClass}
        >
          {months.map((month) => (
            <option key={month} value={month} disabled={month > filters.endMonth}>
              {month}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[140px] flex-col gap-1.5 text-xs font-medium text-muted">
        To
        <select
          value={filters.endMonth}
          onChange={(event) => {
            const endMonth = event.target.value;
            setFilters({
              ...filters,
              endMonth,
              startMonth:
                endMonth < filters.startMonth ? endMonth : filters.startMonth,
            });
          }}
          className={selectClass}
        >
          {months.map((month) => (
            <option key={month} value={month} disabled={month < filters.startMonth}>
              {month}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[160px] flex-col gap-1.5 text-xs font-medium text-muted">
        Department
        <select
          value={filters.department}
          onChange={(event) =>
            setDepartment(event.target.value as DepartmentFilter)
          }
          className={selectClass}
        >
          <option value="All">All</option>
          {DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </label>

      {clickFiltered ? (
        <button
          type="button"
          onClick={() => setDepartment("All")}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-navy px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-navy/90"
        >
          Filtered: {filters.department}
          <X size={14} strokeWidth={2} />
        </button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <Link
          href={actionHref}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80"
        >
          {actionIcon === "back" ? (
            <ArrowLeft size={16} className="text-navy" />
          ) : (
            <BarChart3 size={16} className="text-navy" />
          )}
          {actionLabel}
        </Link>
        <p className="text-xs text-muted">
          {dataset.company.name} · {dataset.period.start} to {dataset.period.end}
        </p>
      </div>
    </div>
  );
}
