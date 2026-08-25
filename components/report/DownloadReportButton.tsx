"use client";

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import { diagnoseKpi, KPI_IDS } from "@/lib/diagnose";
import { dataset } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import { computeKpis } from "@/lib/kpis";
import { ForecastChart } from "@/components/predict/ForecastChart";
import { StatusDot } from "@/components/ui/StatusDot";
import { toolbarButtonClass } from "@/components/filters/FilterBar";

function fileSafe(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function DownloadReportButton() {
  const { records, filters, dateRangeLabel, departmentLabel } = useFilters();
  const snapshotRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const kpis = computeKpis(records);
  const findings = kpis.tiles
    .filter((tile) => KPI_IDS.includes(tile.id as (typeof KPI_IDS)[number]))
    .filter((tile) => tile.status === "red" || tile.status === "amber")
    .map((tile) => diagnoseKpi(tile.id as (typeof KPI_IDS)[number], records))
    .filter((model) => model != null);

  useEffect(() => {
    if (!ready || !busy) return;
    const node = snapshotRef.current;
    if (!node) return;

    let cancelled = false;

    void (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (cancelled || !snapshotRef.current) {
        setBusy(false);
        setReady(false);
        return;
      }
      try {
        const canvas = await html2canvas(snapshotRef.current, {
          backgroundColor: "#F7F8FA",
          scale: 2,
          useCORS: true,
        });
        const image = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: "a4",
        });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 28;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        pdf.addImage(
          image,
          "PNG",
          margin,
          margin,
          canvas.width * ratio,
          canvas.height * ratio,
        );
        pdf.save(
          `Northstar-Financial-Report-${fileSafe(dateRangeLabel)}-${fileSafe(departmentLabel)}.pdf`,
        );
      } finally {
        if (!cancelled) {
          setBusy(false);
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [busy, ready, dateRangeLabel, departmentLabel]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (busy) return;
          setBusy(true);
          setReady(true);
        }}
        disabled={busy}
        className={toolbarButtonClass}
      >
        <Download size={16} className="text-navy" />
        {busy ? "Preparing…" : "Download Report"}
      </button>

      {ready ? (
        <div className="pointer-events-none fixed top-0 left-[-12000px] z-[-1]">
          <div
            ref={snapshotRef}
            className="w-[900px] bg-background p-8 text-foreground"
          >
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
              {dataset.company.industry}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Cairn
            </h1>
            <p className="mt-1 text-sm text-muted">
              {dateRangeLabel} · {departmentLabel} · HQ {dataset.company.hq}
            </p>
            <p className="mt-1 text-xs text-muted">
              Filter months {filters.startMonth} to {filters.endMonth}
            </p>

            <div className="mt-6 grid grid-cols-4 gap-3">
              {kpis.tiles.map((tile) => (
                <div
                  key={tile.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={tile.status} />
                    <p className="text-xs font-medium text-muted">{tile.label}</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold">{tile.display}</p>
                  <p className="mt-1 text-xs text-muted">{tile.context}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">
                    Status {tile.status}
                  </p>
                </div>
              ))}
            </div>

            {findings.length > 0 ? (
              <div className="mt-6 rounded-lg border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Diagnose findings</h2>
                <div className="mt-3 space-y-3">
                  {findings.map((finding) => (
                    <p key={finding.kpiId} className="text-sm leading-6">
                      {finding.varianceSentence}
                      {finding.contributorSentence
                        ? ` ${finding.contributorSentence}`
                        : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted">
                No red or amber metrics in the current filter.
              </p>
            )}

            <div className="mt-6 w-[836px]">
              <ForecastChart series={kpis.series} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
