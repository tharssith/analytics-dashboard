"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Upload } from "lucide-react";
import { DiagnosePanel } from "@/components/diagnose/DiagnosePanel";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { KpiTile } from "@/components/monitor/KpiTile";
import { ForecastChart } from "@/components/predict/ForecastChart";
import { WhatIfSlider } from "@/components/predict/WhatIfSlider";
import { ExportMenu } from "@/components/report/ExportMenu";
import { QaPanel } from "@/components/qa/QaPanel";
import { GenericAnalyticsView } from "@/components/dataset/GenericAnalyticsView";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChangeToast } from "@/components/ui/StatusChangeToast";
import { ProvenancePanel } from "@/components/provenance/ProvenancePanel";
import { dataset as company } from "@/lib/data";
import { KIND_LABELS } from "@/lib/dataset";
import { diagnoseKpi } from "@/lib/diagnose";
import { useFilters } from "@/lib/filters-context";
import { computeKpis } from "@/lib/kpis";
import type { KpiId } from "@/lib/types";
import { filterKeyOf, hrKpiProvenance } from "@/lib/provenance";

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="col-span-12 p-4 sm:col-span-6 xl:col-span-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-36" />
          <Skeleton className="mt-4 h-10 w-full" />
        </Card>
      ))}
      <Card className="col-span-12 p-5 lg:col-span-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Card>
      <Card className="col-span-12 p-5 lg:col-span-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </Card>
    </div>
  );
}

function DashboardBody({ qaConfigured }: { qaConfigured: boolean }) {
  const {
    records,
    sourceRecords,
    loading,
    dataError,
    dataset,
    isHrDashboard,
    genericRows,
    filters,
  } = useFilters();
  const [expanded, setExpanded] = useState<KpiId | "forecast" | null>(null);
  const [bonusPct, setBonusPct] = useState(0);
  const key = filterKeyOf(filters);

  const kpis = useMemo(() => computeKpis(records), [records]);
  const diagnoses = useMemo(() => {
    const next: Partial<Record<KpiId, ReturnType<typeof diagnoseKpi>>> = {};
    for (const tile of kpis.tiles) {
      if (tile.expandable) next[tile.id as KpiId] = diagnoseKpi(tile.id as KpiId, records);
    }
    return next;
  }, [kpis.tiles, records]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background xl:flex-row">
      <div className="min-w-0 flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 xl:pb-6">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
            {dataset && !isHrDashboard ? KIND_LABELS[dataset.kind] : company.company.industry}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Cairn
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dataset && !isHrDashboard
              ? `${dataset.filename} · ${dataset.rows.length.toLocaleString("en-US")} source rows${
                  genericRows.length !== dataset.rows.length
                    ? ` · ${genericRows.length.toLocaleString("en-US")} in current filters`
                    : ""
                } · AI matched file name to ${KIND_LABELS[dataset.typeFromName]} and columns to ${KIND_LABELS[dataset.typeFromHeaders]}`
              : `HQ ${company.company.hq} · Monitor, diagnose, and forecast any business dataset`}
          </p>
        </header>

        <div className="mb-5">
          <FilterBar
            actionHref="/analytics"
            actionLabel="Analytics Dashboard →"
            extraActions={
              <>
                <ExportMenu />
                <Link href="/analytics/edit" className={toolbarButtonClass}>
                  <Pencil size={16} className="text-navy" />
                  Edit Data
                </Link>
                <Link href="/upload" className={toolbarButtonClass}>
                  <Upload size={16} className="text-navy" />
                  Upload data
                </Link>
              </>
            }
          />
        </div>

        {loading || (dataError && isHrDashboard && records.length === 0) ? (
          <DashboardSkeleton />
        ) : !isHrDashboard && dataset ? (
          <GenericAnalyticsView dataset={dataset} rows={genericRows} />
        ) : (
          <>
            <div className="grid grid-cols-12 gap-4">
              {kpis.tiles.map((tile) => {
                const isOpen = expanded === tile.id;
                const model = diagnoses[tile.id as KpiId] ?? null;
                return (
                  <Card
                    key={tile.id}
                    className={`overflow-hidden transition-[grid-column] duration-300 ${
                      isOpen
                        ? "col-span-12"
                        : "col-span-12 sm:col-span-6 xl:col-span-3"
                    }`}
                  >
                    <KpiTile
                      tile={{ ...tile, expandable: true }}
                      expanded={isOpen}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === tile.id ? null : (tile.id as KpiId),
                        )
                      }
                    />
                    <ProvenancePanel
                      open={isOpen}
                      provenance={hrKpiProvenance(
                        records,
                        sourceRecords,
                        tile.id as KpiId,
                        key,
                      )}
                    />
                    <DiagnosePanel open={isOpen} model={model} />
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-8">
                <ForecastChart
                  series={kpis.series}
                  selected={expanded === "forecast"}
                  onInspect={() =>
                    setExpanded((current) => (current === "forecast" ? null : "forecast"))
                  }
                />
                {expanded === "forecast" ? (
                  <div className="overflow-hidden rounded-b-lg border border-t-0 border-border bg-card">
                    <ProvenancePanel
                      open
                      provenance={hrKpiProvenance(records, sourceRecords, "headcount", key)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="col-span-12 lg:col-span-4">
                <WhatIfSlider
                  latest={kpis.latest}
                  bonusPct={bonusPct}
                  onChange={setBonusPct}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <QaPanel configured={qaConfigured} />
      <StatusChangeToast />
    </div>
  );
}

export function Dashboard({ qaConfigured }: { qaConfigured: boolean }) {
  return <DashboardBody qaConfigured={qaConfigured} />;
}
