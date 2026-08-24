"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
import type { RawCsvRow } from "@/lib/csv";
import { buildExportModel } from "@/lib/export-model";
import { useFilters } from "@/lib/filters-context";

type Format = "xlsx" | "pptx" | "pdf";

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function ExportMenu({
  fileName,
  headers,
  rows,
}: {
  fileName?: string;
  headers?: string[];
  rows?: RawCsvRow[];
}) {
  const {
    dataset,
    isHrDashboard,
    records,
    genericRows,
    dateRangeLabel,
    departmentLabel,
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
      });
      const files = await import("@/lib/export-files");
      if (format === "xlsx") await files.downloadExcelReport(model);
      else if (format === "pptx") await files.downloadPptReport(model);
      else await files.downloadPdfReport(model);
    } finally {
      setBusy(null);
    }
  }

  const label =
    busy === "xlsx" ? "Excel…" : busy === "pptx" ? "PowerPoint…" : busy === "pdf" ? "PDF…" : "Export";

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
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-md border border-border bg-white py-1 shadow-lg"
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
        </div>
      ) : null}
    </div>
  );
}
