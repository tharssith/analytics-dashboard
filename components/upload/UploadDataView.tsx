"use client";

import { useRef, useState } from "react";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import {
  REQUIRED_HEADERS,
  applyColumnMapping,
  emptyMapping,
  isMappingComplete,
  sanitizeColumnMapping,
  validateMappedRows,
  type ColumnMapping,
  type RawCsvRow,
} from "@/lib/csv";
import { dataset } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import type { HrRecord } from "@/lib/types";

const selectClass =
  "h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm font-medium text-foreground outline-none transition-colors duration-150 focus:border-navy";

export function UploadDataView() {
  const { replaceSourceRecords } = useFilters();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingRecords, setPendingRecords] = useState<HrRecord[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const mapRequest = useRef(0);

  function resetFileState() {
    setHeaders([]);
    setRawRows([]);
    setMapping(emptyMapping());
    setPendingRecords(null);
    setConfirming(false);
    setWarnings([]);
    setMappingLoading(false);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    resetFileState();
    try {
      const { parseRawUpload } = await import("@/lib/spreadsheet");
      const raw = await parseRawUpload(file);
      setErrors(raw.errors);
      if (raw.errors.length > 0 && raw.rows.length === 0) return;

      setHeaders(raw.headers);
      setRawRows(raw.rows);
      setMappingLoading(true);
      const requestId = mapRequest.current + 1;
      mapRequest.current = requestId;

      try {
        const response = await fetch("/api/map-columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headers: raw.headers }),
        });
        const payload = (await response.json()) as Record<string, unknown>;
        if (mapRequest.current !== requestId) return;
        setMapping(sanitizeColumnMapping(payload, raw.headers));
      } catch {
        if (mapRequest.current !== requestId) return;
        setMapping(sanitizeColumnMapping({}, raw.headers));
        setErrors([
          "Could not suggest column matches. Pick each required field from the dropdowns.",
        ]);
      } finally {
        if (mapRequest.current === requestId) setMappingLoading(false);
      }
    } catch {
      setErrors(["Could not read that file. Use a CSV or Excel (.xlsx) spreadsheet."]);
    }
  }

  function applyMapping() {
    if (!isMappingComplete(mapping, headers)) {
      setErrors(["Match every required field to a column from the file."]);
      return;
    }
    const mapped = applyColumnMapping(rawRows, mapping);
    const parsed = validateMappedRows(mapped);
    setErrors(parsed.errors);
    setWarnings(parsed.warnings);
    setPendingRecords(parsed.errors.length === 0 ? parsed.records : null);
  }

  async function confirmReplace() {
    if (!pendingRecords) return;
    setBusy(true);
    const ok = await replaceSourceRecords(pendingRecords);
    setBusy(false);
    if (ok) {
      setFileName(null);
      setErrors([]);
      resetFileState();
    }
  }

  const mappingReady = headers.length > 0 && !mappingLoading;
  const canContinue = mappingReady && isMappingComplete(mapping, headers);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
          {dataset.company.industry}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Upload data
        </h1>
        <p className="mt-1 text-sm text-muted">
          Replace your saved dataset with a CSV or Excel file. Department names
          are read from the file, not limited to the original four teams.
        </p>
      </header>

      <div className="mb-5">
        <FilterBar
          actionHref="/dashboard"
          actionLabel="← Back to Dashboard"
          actionIcon="back"
        />
      </div>

      <Card className="max-w-xl p-5">
        <label className="flex cursor-pointer flex-col gap-2">
          <span className="text-xs font-medium text-muted">CSV or Excel file</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="text-sm text-foreground file:mr-3 file:h-9 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:text-sm file:font-medium file:text-foreground file:transition-colors file:duration-150 hover:file:border-navy/40 hover:file:bg-background/80"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-muted">
          Required columns: month, department, headcount, target_headcount,
          new_hires, attrition_count, time_to_hire_days, referral_pct,
          job_board_pct, agency_pct.
        </p>
        {fileName ? (
          <p className="mt-3 text-sm text-foreground">
            {fileName}
            {rawRows.length > 0 ? ` · ${rawRows.length} rows` : ""}
          </p>
        ) : null}

        {mappingLoading ? (
          <p className="mt-4 text-sm text-muted">Matching column names…</p>
        ) : null}

        {mappingReady ? (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted">
              <span>Required field</span>
              <span>Matched column</span>
            </div>
            {REQUIRED_HEADERS.map((field) => (
              <label
                key={field}
                className="grid grid-cols-2 items-center gap-2 text-sm text-foreground"
              >
                <span className="truncate font-medium">{field}</span>
                <select
                  value={mapping[field]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMapping((current) => ({ ...current, [field]: value }));
                    setPendingRecords(null);
                  }}
                  className={selectClass}
                >
                  <option value="">Select column</option>
                  {headers.map((header) => (
                    <option key={`${field}-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p className="text-xs leading-5 text-muted">
              This only renames columns — your data values are never changed or
              sent to the AI.
            </p>
            <button
              type="button"
              disabled={!canContinue}
              onClick={applyMapping}
              className="inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue with this mapping
            </button>
          </div>
        ) : null}

        {errors.length > 0 ? (
          <ul className="mt-4 space-y-1 text-xs text-rag-red">
            {errors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-rag-amber">
            {warnings.slice(0, 6).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        {pendingRecords && errors.length === 0 ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-5 inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90"
          >
            Replace my data · {pendingRecords.length} rows
          </button>
        ) : null}
      </Card>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4">
          <Card className="w-full max-w-md p-5">
            <p className="text-sm leading-6 text-foreground">
              This will replace your current data — continue?
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void confirmReplace()}
                disabled={busy}
                className="inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:opacity-40"
              >
                {busy ? "Replacing…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className={toolbarButtonClass}
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
