"use client";

import { useState } from "react";
import type { DatasetClaim } from "@/lib/claims";
import { claimFromProvenance } from "@/lib/claims";
import type { ProvenanceResult } from "@/lib/provenance";
import { useFilters } from "@/lib/filters-context";
import type { CustomMeasure, SheetSpec } from "@/lib/analysis-workspace";

export function ProvenancePanel({
  provenance,
  open = true,
  spec,
  custom,
  compact = false,
}: {
  provenance: ProvenanceResult | null;
  open?: boolean;
  spec?: SheetSpec | null;
  custom?: CustomMeasure[];
  compact?: boolean;
}) {
  const { saveClaim } = useFilters();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open || !provenance) return null;

  async function persist() {
    if (!provenance || busy) return;
    setBusy(true);
    const claim: DatasetClaim = claimFromProvenance(provenance, { spec, custom });
    const ok = await saveClaim(claim);
    setSaved(ok);
    setBusy(false);
  }

  return (
    <div className={compact ? "border-t border-border px-3 py-2" : "border-t border-border px-4 py-4"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy">
            Provenance
          </p>
          <p className="mt-1 text-sm leading-6 text-foreground">{provenance.narrative}</p>
        </div>
        <button
          type="button"
          onClick={() => void persist()}
          disabled={busy}
          className="inline-flex h-7 items-center rounded-md border border-border bg-white px-2 text-[11px] font-medium text-foreground hover:border-navy/40"
        >
          {saved ? "Claim saved" : busy ? "Saving…" : "Watch this claim"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {provenance.sourceRowCount.toLocaleString("en-US")} source rows ·{" "}
        {provenance.usedRowCount.toLocaleString("en-US")} used ·{" "}
        {provenance.unusedRowCount.toLocaleString("en-US")} outside this number ·{" "}
        {provenance.flaggedCount.toLocaleString("en-US")} flagged
      </p>
      {provenance.swingRows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted">
                <th className="pb-1 font-medium">Swing row</th>
                <th className="pb-1 font-medium">Value</th>
                <th className="pb-1 font-medium">Without it</th>
              </tr>
            </thead>
            <tbody>
              {provenance.swingRows.map((row) => (
                <tr key={row.id} className="border-t border-border/80">
                  <td className="py-1.5 pr-3">
                    <p className="font-medium text-foreground">{row.label}</p>
                    <p className="text-[11px] text-muted">{row.hint}</p>
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {row.value.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-1.5 tabular-nums">
                    {row.withoutValue.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">No single row moves this number.</p>
      )}
      <p className="mt-3 text-xs font-medium text-foreground">
        Exclude these {provenance.swingRows.length || 0} row
        {provenance.swingRows.length === 1 ? "" : "s"} and the number becomes{" "}
        {provenance.excludeKFormatted}.
      </p>
      {provenance.flaggedRows.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Flagged and kept: {provenance.flaggedRows.slice(0, 4).map((row) => row.label).join("; ")}
          {provenance.flaggedRows.length > 4 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}

export function SecondOpinionCard({
  provenance,
  spec,
  custom,
}: {
  provenance: ProvenanceResult | null;
  spec?: SheetSpec | null;
  custom?: CustomMeasure[];
}) {
  if (!provenance) {
    return (
      <p className="text-xs text-muted">Add a category and a measure, then click the chart.</p>
    );
  }
  return (
    <div className="rounded-md border border-navy/20 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy">
        Second opinion
      </p>
      <p className="mt-1 text-sm font-medium leading-6 text-foreground">
        {provenance.metricLabel} is {provenance.formatted}.
      </p>
      <p className="mt-1 text-sm leading-6 text-foreground">{provenance.narrative}</p>
      <p className="mt-2 text-xs text-muted">
        Story now: {provenance.storyBefore}. Without swing rows: {provenance.storyAfter}.
      </p>
      <ProvenancePanel provenance={provenance} spec={spec} custom={custom} compact />
    </div>
  );
}
