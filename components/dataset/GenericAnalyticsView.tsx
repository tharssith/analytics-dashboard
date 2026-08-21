"use client";

import { KpiTile } from "@/components/monitor/KpiTile";
import { GenericBreakdownChart, GenericTrendChart } from "@/components/dataset/GenericCharts";
import { Card } from "@/components/ui/Card";
import { KIND_LABELS, computeGenericAnalytics, type StoredDataset } from "@/lib/dataset";
import type { RawCsvRow } from "@/lib/csv";

export function GenericAnalyticsView({
  dataset,
  rows,
}: {
  dataset: StoredDataset;
  rows: RawCsvRow[];
}) {
  const generic = computeGenericAnalytics(rows, dataset);

  return (
    <>
      <div className="grid grid-cols-12 gap-4">
        {generic.tiles.map((tile) => (
          <Card key={tile.id} className="col-span-12 sm:col-span-6 xl:col-span-3">
            <KpiTile tile={tile} expanded={false} onToggle={() => undefined} />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <GenericTrendChart title={generic.seriesLabel} points={generic.series} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <GenericBreakdownChart title={generic.breakdownLabel} points={generic.breakdown} />
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
