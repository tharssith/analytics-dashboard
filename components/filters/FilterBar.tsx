"use client";

import { DEPARTMENTS, dataset, uniqueMonths } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import type { DepartmentFilter } from "@/lib/types";

export function FilterBar() {
  const { filters, setFilters } = useFilters();
  const months = uniqueMonths();

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
          className="h-9 rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none focus:border-navy"
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
          className="h-9 rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none focus:border-navy"
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
            setFilters({
              ...filters,
              department: event.target.value as DepartmentFilter,
            })
          }
          className="h-9 rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none focus:border-navy"
        >
          <option value="All">All</option>
          {DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </label>

      <p className="ml-auto text-xs text-muted">
        {dataset.company.name} · {dataset.period.start} to {dataset.period.end}
      </p>
    </div>
  );
}
