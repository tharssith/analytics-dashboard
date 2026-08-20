"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { DiagnosePanel } from "@/components/diagnose/DiagnosePanel";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { KpiTile } from "@/components/monitor/KpiTile";
import { ForecastChart } from "@/components/predict/ForecastChart";
import { WhatIfSlider } from "@/components/predict/WhatIfSlider";
import { DownloadReportButton } from "@/components/report/DownloadReportButton";
import { QaPanel } from "@/components/qa/QaPanel";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChangeToast } from "@/components/ui/StatusChangeToast";
import { dataset } from "@/lib/data";
import { diagnoseKpi } from "@/lib/diagnose";
import { useFilters } from "@/lib/filters-context";
import { computeKpis } from "@/lib/kpis";
import type { KpiId } from "@/lib/types";

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
  const { records, loading, dataError } = useFilters();
  const [expanded, setExpanded] = useState<KpiId | null>(null);
  const [bonusPct, setBonusPct] = useState(0);

  const kpis = useMemo(() => computeKpis(records), [records]);
  const diagnoses = useMemo(() => {
    const next: Partial<Record<KpiId, ReturnType<typeof diagnoseKpi>>> = {};
    for (const tile of kpis.tiles) {
      if (tile.expandable) next[tile.id] = diagnoseKpi(tile.id, records);
    }
    return next;
  }, [kpis.tiles, records]);

  useEffect(() => {
    if (!expanded) return;
    const tile = kpis.tiles.find((item) => item.id === expanded);
    if (!tile?.expandable) setExpanded(null);
  }, [expanded, kpis.tiles]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background xl:flex-row">
      <div className="min-w-0 flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 xl:pb-6">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
            {dataset.company.industry}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {dataset.company.name} HR Analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            HQ {dataset.company.hq} · Monitor, diagnose, and forecast workforce
            health
          </p>
        </header>

        <div className="mb-5">
          <FilterBar
            actionHref="/analytics"
            actionLabel="Analytics Dashboard →"
            extraActions={
              <>
                <DownloadReportButton />
                <Link href="/upload" className={toolbarButtonClass}>
                  <Upload size={16} className="text-navy" />
                  Upload CSV
                </Link>
              </>
            }
          />
        </div>

        {loading || (dataError && records.length === 0) ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-12 gap-4">
              {kpis.tiles.map((tile) => {
                const isOpen = expanded === tile.id;
                const model = diagnoses[tile.id] ?? null;
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
                      tile={tile}
                      expanded={isOpen}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === tile.id ? null : tile.id,
                        )
                      }
                    />
                    <DiagnosePanel open={isOpen} model={model} />
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-8">
                <ForecastChart series={kpis.series} />
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
