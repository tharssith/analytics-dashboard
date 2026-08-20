"use client";

import { useState } from "react";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import { parseHrCsv } from "@/lib/csv";
import { dataset } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";

export function UploadDataView() {
  const { replaceSourceRecords } = useFilters();
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseHrCsv(text);
    setFileName(file.name);
    setErrors(parsed.errors);
    setWarnings(parsed.warnings);
    setRowCount(parsed.records.length);
    setPendingText(parsed.errors.length === 0 ? text : null);
    setConfirming(false);
  }

  async function confirmReplace() {
    if (!pendingText) return;
    const parsed = parseHrCsv(pendingText);
    if (parsed.errors.length > 0) {
      setErrors(parsed.errors);
      return;
    }
    setBusy(true);
    const ok = await replaceSourceRecords(parsed.records);
    setBusy(false);
    if (ok) {
      setConfirming(false);
      setPendingText(null);
      setFileName(null);
      setWarnings([]);
      setErrors([]);
      setRowCount(0);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
          {dataset.company.industry}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Upload CSV
        </h1>
        <p className="mt-1 text-sm text-muted">
          Replace your saved dataset. Department names are read from the file,
          not limited to the original four teams.
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
          <span className="text-xs font-medium text-muted">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
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
            {rowCount > 0 ? ` · ${rowCount} rows` : ""}
          </p>
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

        {pendingText && errors.length === 0 ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-5 inline-flex h-9 items-center rounded-md bg-navy px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90"
          >
            Replace my data
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
