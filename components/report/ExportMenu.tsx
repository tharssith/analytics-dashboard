"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Presentation, ScrollText } from "lucide-react";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
import { recordsToRawRows, type RawCsvRow } from "@/lib/csv";
import { buildExportModel, type AnalysisExportSlice } from "@/lib/export-model";
import { useFilters } from "@/lib/filters-context";
import { dashboardProvenance, filterKeyOf, vizProvenance } from "@/lib/provenance";
import type { CustomMeasure, SheetSpec } from "@/lib/analysis-workspace";

type Format = "xlsx" | "pptx" | "pdf" | "brief";

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function ExportMenu({
  fileName,
  headers,
  rows,
  metricHint,
  analysis,
  sheetSpec,
  customMeasures,
}: {
  fileName?: string;
  headers?: string[];
  rows?: RawCsvRow[];
  metricHint?: string;
  analysis?: AnalysisExportSlice;
  sheetSpec?: SheetSpec;
  customMeasures?: CustomMeasure[];
}) {
  const {
    dataset,
    isHrDashboard,
    records,
    sourceRecords,
    genericRows,
    dateRangeLabel,
    departmentLabel,
    filters,
  } = useFilters();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  async function exportAs(format: Format) {
    if (busy) return;
    setBusy(format);
    setOpen(false);
    await yieldToPaint();
    try {
      const key = filterKeyOf(filters);
      const provenance = sheetSpec
        ? vizProvenance(
            dataset && !isHrDashboard ? dataset.rows : recordsToRawRows(sourceRecords),
            rows ?? genericRows,
            sheetSpec,
            customMeasures ?? [],
            key,
            headers,
          )
        : dashboardProvenance({
            isHr: isHrDashboard,
            records,
            sourceRecords,
            dataset,
            genericRows,
            sourceRows: dataset?.rows ?? genericRows,
            filterKey: key,
          });
      const model = buildExportModel({
        filename: fileName,
        dataset,
        isHr: isHrDashboard,
        records,
        genericRows,
        headers,
        rows,
        dateRangeLabel,
        categoryLabel: departmentLabel,
        metricHint,
        analysis,
        provenance,
      });
      const files = await import("@/lib/export-files");
      if (format === "xlsx") await files.downloadExcelReport(model);
      else if (format === "pptx") await files.downloadPptReport(model);
      else if (format === "brief") await files.downloadDecisionBrief(model);
      else await files.downloadPdfReport(model);
    } finally {
      setBusy(null);
    }
  }

  const label =
    busy === "xlsx"
      ? "Excel…"
      : busy === "pptx"
        ? "PowerPoint…"
        : busy === "pdf"
          ? "PDF…"
          : busy === "brief"
            ? "Brief…"
            : "Export";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={Boolean(busy)}
        className={toolbarButtonClass}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={16} className="text-navy" />
        {label}
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void exportAs("xlsx")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
          >
            <FileSpreadsheet size={15} className="text-navy" />
            Excel
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void exportAs("pptx")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
          >
            <Presentation size={15} className="text-navy" />
            PowerPoint
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void exportAs("pdf")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
          >
            <FileText size={15} className="text-navy" />
            PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void exportAs("brief")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
          >
            <ScrollText size={15} className="text-navy" />
            Decision brief
          </button>
        </div>
      ) : null}
    </div>
  );
}
