"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, LogOut, X } from "lucide-react";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import { dataset, uniqueDepartments, uniqueMonths } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import type { DepartmentFilter } from "@/lib/types";

export const toolbarButtonClass =
  "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80";

const selectClass =
  "h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 focus:border-navy";

export function FilterBar({
  actionHref,
  actionLabel,
  actionIcon = "forward",
  extraActions,
}: {
  actionHref: string;
  actionLabel: string;
  actionIcon?: "forward" | "back";
  extraActions?: ReactNode;
}) {
  const { filters, setFilters, setDepartment, sourceRecords } = useFilters();
  const months = uniqueMonths(sourceRecords);
  const departments = uniqueDepartments(sourceRecords);
  const clickFiltered = filters.department !== "All";

  return (
    <div className="flex flex-wrap items-end gap-3 sm:gap-4">
      <label className="flex min-w-0 flex-1 basis-[calc(50%-0.4rem)] flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-[140px] sm:flex-none sm:basis-auto">
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

      <label className="flex min-w-0 flex-1 basis-[calc(50%-0.4rem)] flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-[140px] sm:flex-none sm:basis-auto">
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

      <label className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 text-xs font-medium text-muted sm:min-w-[160px] sm:flex-none sm:basis-auto">
        Department
        <select
          value={filters.department}
          onChange={(event) =>
            setDepartment(event.target.value as DepartmentFilter)
          }
          className={selectClass}
        >
          <option value="All">All</option>
          {departments.map((department) => (
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

      <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
        <Link href={actionHref} className={toolbarButtonClass}>
          {actionIcon === "back" ? (
            <ArrowLeft size={16} className="text-navy" />
          ) : (
            <BarChart3 size={16} className="text-navy" />
          )}
          {actionLabel}
        </Link>
        {extraActions}
        <form action={logoutAction}>
          <button type="submit" className={toolbarButtonClass}>
            <LogOut size={16} className="text-navy" />
            Log Out
          </button>
        </form>
        <p className="text-xs text-muted">
          {dataset.company.name} · {dataset.period.start} to {dataset.period.end}
        </p>
      </div>
    </div>
  );
}
