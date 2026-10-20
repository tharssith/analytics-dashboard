"use client";

import { useMemo, useState } from "react";
import { KpiTile } from "@/components/monitor/KpiTile";
import { GenericBreakdownChart, GenericTrendChart } from "@/components/dataset/GenericCharts";
import { Card } from "@/components/ui/Card";
import { SecondOpinionCard, ProvenancePanel } from "@/components/provenance/ProvenancePanel";
import { KIND_LABELS, computeGenericAnalytics, type StoredDataset } from "@/lib/dataset";
import type { RawCsvRow } from "@/lib/csv";
import { useFilters } from "@/lib/filters-context";
import { filterKeyOf, genericMetricProvenance } from "@/lib/provenance";

export function GenericAnalyticsView({
  dataset,
  rows,
}: {
  dataset: StoredDataset;
  rows: RawCsvRow[];
}) {
  const { filters } = useFilters();
  const generic = computeGenericAnalytics(rows, dataset);
  const [inspected, setInspected] = useState<string | "trend" | "breakdown" | null>(null);
  const key = filterKeyOf(filters);
  const metricFor = (id: string) =>
    genericMetricProvenance(rows, dataset.rows, dataset, id, key);
  const primary = dataset.metricFields[0] ?? generic.tiles[0]?.id ?? "";
  const chartProvenance = useMemo(
    () => (primary ? metricFor(primary) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primary, rows, dataset, key],
  );

  return (
    <>
      <div className="grid grid-cols-12 gap-4">
        {generic.tiles.map((tile) => {
          const isOpen = inspected === tile.id;
          return (
            <Card
              key={tile.id}
              className={`overflow-hidden ${isOpen ? "col-span-12" : "col-span-12 sm:col-span-6 xl:col-span-3"}`}
            >
              <KpiTile
                tile={{ ...tile, expandable: true }}
                expanded={isOpen}
                onToggle={() => setInspected((current) => (current === tile.id ? null : tile.id))}
              />
              <ProvenancePanel open={isOpen} provenance={metricFor(tile.id)} />
            </Card>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <GenericTrendChart
            title={generic.seriesLabel}
            points={generic.series}
            selected={inspected === "trend"}
            onInspect={() => setInspected((current) => (current === "trend" ? null : "trend"))}
          />
          {inspected === "trend" ? (
            <div className="mt-3">
              <SecondOpinionCard provenance={chartProvenance} />
            </div>
          ) : null}
        </div>
        <div className="col-span-12 lg:col-span-4">
          <GenericBreakdownChart
            title={generic.breakdownLabel}
            points={generic.breakdown}
            selected={inspected === "breakdown"}
            onInspect={() =>
              setInspected((current) => (current === "breakdown" ? null : "breakdown"))
            }
          />
          {inspected === "breakdown" ? (
            <div className="mt-3">
              <SecondOpinionCard provenance={chartProvenance} />
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        {KIND_LABELS[dataset.kind]} · {generic.rowCount.toLocaleString("en-US")} rows
        {dataset.timeField ? ` · time: ${dataset.timeField}` : ""}
        {dataset.categoryField ? ` · grouped by ${dataset.categoryField}` : ""}
      </p>
    </>
  );
}
