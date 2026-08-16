"use client";

import { useMemo } from "react";
import { DepartmentBreakdownChart } from "@/components/diagnose/DiagnosePanel";
import { FilterBar } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import { dataset, filterRecords } from "@/lib/data";
import {
  diagnoseKpi,
  KPI_IDS,
  KPI_TITLES,
} from "@/lib/diagnose";
import { useFilters } from "@/lib/filters-context";
import type { Department } from "@/lib/types";

export function AnalyticsDashboard() {
  const { filters, records, setDepartment } = useFilters();

  const allDepartmentRecords = useMemo(
    () =>
      filterRecords(dataset.records, {
        ...filters,
        department: "All",
      }),
    [filters],
  );

  const cards = useMemo(
    () =>
      KPI_IDS.map((id) => ({
        id,
        title: KPI_TITLES[id],
        filtered: diagnoseKpi(id, records),
        breakdown: diagnoseKpi(id, allDepartmentRecords),
      })),
    [allDepartmentRecords, records],
  );

  function onDepartmentClick(department: Department) {
    setDepartment(filters.department === department ? "All" : department);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
          {dataset.company.industry}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Analytics Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Department breakdowns for the current date range. Click a bar to
          filter the rest of the app.
        </p>
      </header>

      <div className="mb-5">
        <FilterBar
          actionHref="/"
          actionLabel="← Back to Dashboard"
          actionIcon="back"
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {cards.map((card) => {
          if (!card.filtered || !card.breakdown) return null;
          return (
            <Card key={card.id} className="col-span-12 p-5 lg:col-span-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  {card.title}
                </h2>
                <p className="mt-1 text-xs text-muted">{card.filtered.monthLabel}</p>
              </div>
              <p className="text-sm leading-6 text-foreground">
                {card.filtered.varianceSentence}
              </p>
              <div className="mt-4">
                <p className="mb-3 text-xs font-medium text-muted">
                  Department breakdown
                </p>
                <DepartmentBreakdownChart
                  model={card.breakdown}
                  selectedDepartment={filters.department}
                  onDepartmentClick={onDepartmentClick}
                />
                {filters.department === "All" && card.breakdown.contributorSentence ? (
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {card.breakdown.contributorSentence}
                  </p>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
