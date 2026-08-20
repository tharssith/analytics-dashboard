"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import { AiFixReview, type SuggestedFix } from "@/components/upload/AiFixReview";
import { ChoiceStep } from "@/components/upload/ChoiceStep";
import { ColumnMappingForm } from "@/components/upload/ColumnMappingForm";
import { ManualFixTable } from "@/components/upload/ManualFixTable";
import { navyButtonClass } from "@/components/upload/upload-ui";
import {
  applyColumnMapping,
  emptyMapping,
  isMappingComplete,
  mappingFillCount,
  mappingFromExactHeaders,
  sanitizeColumnMapping,
  type ColumnMapping,
  type RawCsvRow,
  type RequiredHeader,
} from "@/lib/csv";
import { dataset, uniqueDepartments } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import {
  applyValueFixes,
  failingRowIds,
  groupIssues,
  inspectRows,
  mappedRowsFromRaw,
  rowsToRecords,
  type CellIssue,
  type MappedRow,
} from "@/lib/upload-validate";

function remainingIssuesMessage(issues: CellIssue[]): string {
  const rowCount = failingRowIds(issues).size;
  const issueCount = issues.length;
  return `${rowCount} row${rowCount === 1 ? "" : "s"} still ${
    rowCount === 1 ? "has" : "have"
  } ${issueCount} validation issue${issueCount === 1 ? "" : "s"}. Fix the highlighted cells before saving.`;
}

type Mode = "ai" | "manual";
type Stage =
  | "choice"
  | "mapping"
  | "ai-fixes"
  | "manual-fix"
  | "ready"
  | "saved";

export function UploadDataView() {
  const { replaceSourceRecords } = useFilters();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [stage, setStage] = useState<Stage>("choice");
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedFix[]>([]);
  const [aiSkipped, setAiSkipped] = useState(0);
  const [audit, setAudit] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const mapRequest = useRef(0);

  function resetWorking() {
    setMode(null);
    setStage("choice");
    setMapping(emptyMapping());
    setMappingLoading(false);
    setMappedRows([]);
    setFlaggedIds(new Set());
    setAiSuggestions([]);
    setAiSkipped(0);
    setAiLoading(false);
    setAudit([]);
    setSaveError(null);
    setMappingError(null);
    setSavedLabel(null);
  }

  async function onFile(file: File) {
    setFileName(file.name);
    resetWorking();
    setParseError(null);
    setHeaders([]);
    setRawRows([]);
    try {
      const { parseRawUpload } = await import("@/lib/spreadsheet");
      const raw = await parseRawUpload(file);
      if (raw.errors.length > 0 && raw.rows.length === 0) {
        setParseError(raw.errors[0] ?? "Could not parse that file.");
        return;
      }
      setHeaders(raw.headers);
      setRawRows(raw.rows);
      setStage("choice");
    } catch {
      setParseError("Could not read that file. Use a CSV or Excel (.xlsx) spreadsheet.");
    }
  }

  async function chooseMode(nextMode: Mode) {
    const fileHeaders = headers;
    setMode(nextMode);
    setStage("mapping");
    setSaveError(null);
    setMappingError(null);
    if (nextMode === "manual") {
      setMapping(mappingFromExactHeaders(fileHeaders));
      return;
    }
    setMappingLoading(true);
    const requestId = mapRequest.current + 1;
    mapRequest.current = requestId;
    console.info("[upload] map-columns request", {
      count: fileHeaders.length,
      headers: fileHeaders,
    });
    if (fileHeaders.length === 0) {
      setMapping(emptyMapping());
      setMappingError(
        "AI couldn't determine matches — please map manually below",
      );
      setMappingLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/map-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: fileHeaders }),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      console.info("[upload] map-columns response", {
        ok: response.ok,
        status: response.status,
        payload,
      });
      if (mapRequest.current !== requestId) return;
      if (!response.ok) {
        setMapping(mappingFromExactHeaders(fileHeaders));
        setMappingError(
          "AI couldn't determine matches — please map manually below",
        );
        return;
      }
      const next = sanitizeColumnMapping(payload, fileHeaders);
      setMapping(next);
      if (mappingFillCount(next) === 0) {
        setMappingError(
          "AI couldn't determine matches — please map manually below",
        );
      }
    } catch (error) {
      console.info("[upload] map-columns failed", error);
      if (mapRequest.current !== requestId) return;
      setMapping(mappingFromExactHeaders(fileHeaders));
      setMappingError(
        "AI couldn't determine matches — please map manually below",
      );
    } finally {
      if (mapRequest.current === requestId) setMappingLoading(false);
    }
  }

  async function continueMapping() {
    if (!isMappingComplete(mapping, headers)) return;
    const rows = mappedRowsFromRaw(applyColumnMapping(rawRows, mapping));
    setMappedRows(rows);
    const mappedCount = Object.values(mapping).filter(Boolean).length;
    const prefix = mode === "ai" ? "AI" : "Manual";
    const nextAudit = [`${prefix}: mapped ${mappedCount} columns`];
    const issues = inspectRows(rows);
    if (mode === "manual") {
      setAudit(nextAudit);
      if (issues.length === 0) {
        await persistRows(rows);
        return;
      }
      setSaveError(null);
      setFlaggedIds(failingRowIds(issues));
      setStage("manual-fix");
      return;
    }
    if (issues.length === 0) {
      setAudit(nextAudit);
      setStage("ready");
      return;
    }
    setFlaggedIds(failingRowIds(issues));
    setAudit(nextAudit);
    setStage("ai-fixes");
    setAiLoading(true);
    try {
      const response = await fetch("/api/fix-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupIssues(issues) }),
      });
      const payload = (await response.json()) as {
        groups?: Array<{
          field?: RequiredHeader;
          fixes?: Array<{ original?: string; suggested?: string | null }>;
        }>;
      };
      const suggestions: SuggestedFix[] = [];
      let skipped = 0;
      for (const group of payload.groups ?? []) {
        if (!group.field) continue;
        for (const fix of group.fixes ?? []) {
          if (typeof fix.original !== "string") continue;
          if (typeof fix.suggested === "string" && fix.suggested.length > 0) {
            suggestions.push({
              field: group.field,
              original: fix.original,
              suggested: fix.suggested,
            });
          } else {
            skipped += 1;
          }
        }
      }
      setAiSuggestions(suggestions);
      setAiSkipped(skipped);
    } catch {
      setAiSuggestions([]);
      setAiSkipped(inspectRows(rows).length);
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiFixes() {
    let nextRows = mappedRows;
    const counts = new Map<RequiredHeader, number>();
    for (const field of new Set(aiSuggestions.map((fix) => fix.field))) {
      const fixes = aiSuggestions.filter((fix) => fix.field === field);
      const before = inspectRows(nextRows).filter((issue) => issue.field === field)
        .length;
      nextRows = applyValueFixes(nextRows, field, fixes);
      const after = inspectRows(nextRows).filter((issue) => issue.field === field)
        .length;
      const fixed = Math.max(0, before - after);
      if (fixed > 0) counts.set(field, fixed);
    }
    setMappedRows(nextRows);
    const remaining = inspectRows(nextRows);
    setFlaggedIds(failingRowIds(remaining));
    const fixNotes = [...counts.entries()].map(
      ([field, count]) => `fixed ${count} ${field} value${count === 1 ? "" : "s"}`,
    );
    setAudit((current) =>
      fixNotes.length > 0 ? [...current, `AI: ${fixNotes.join(", ")}`] : current,
    );
    setStage(remaining.length === 0 ? "ready" : "manual-fix");
  }

  function openManualFix() {
    setFlaggedIds(failingRowIds(inspectRows(mappedRows)));
    setStage("manual-fix");
  }

  function onManualChange(next: MappedRow[]) {
    setMappedRows(next);
    setSaveError(null);
    setFlaggedIds((current) => {
      const nextIds = new Set(current);
      for (const id of failingRowIds(inspectRows(next))) nextIds.add(id);
      return nextIds;
    });
  }

  async function persistRows(rows: MappedRow[]) {
    setMappedRows(rows);
    const issues = inspectRows(rows);
    if (issues.length > 0) {
      const failing = failingRowIds(issues);
      setFlaggedIds((current) => {
        const next = new Set(current);
        for (const id of failing) next.add(id);
        return next;
      });
      setSaveError(remainingIssuesMessage(issues));
      setStage("manual-fix");
      return false;
    }

    const converted = rowsToRecords(rows);
    if (converted.errors.length > 0) {
      setSaveError(converted.errors[0] ?? "Some rows still fail validation.");
      setFlaggedIds(failingRowIds(inspectRows(rows)));
      setStage("manual-fix");
      return false;
    }

    setBusy(true);
    setSaveError(null);
    const ok = await replaceSourceRecords(converted.records);
    setBusy(false);
    if (!ok) {
      setSaveError("Could not save records.");
      setStage((current) => (current === "manual-fix" ? current : "ready"));
      return false;
    }

    const remainingFlagged = [...flaggedIds].filter((id) =>
      inspectRows(rows).some((issue) => issue.rowId === id),
    ).length;
    const manualFixed = Math.max(0, flaggedIds.size - remainingFlagged);
    if (mode === "manual" && flaggedIds.size > 0) {
      setAudit((current) => [
        ...current,
        `Manual: fixed ${manualFixed} row${manualFixed === 1 ? "" : "s"} by hand`,
      ]);
    } else if (mode === "ai" && manualFixed > 0) {
      setAudit((current) => [
        ...current,
        `AI: ${manualFixed} remaining cell group${manualFixed === 1 ? "" : "s"} fixed manually`,
      ]);
    }
    const depts = uniqueDepartments(converted.records);
    setSavedLabel(
      `Loaded ${converted.records.length} records for ${depts.length} department${
        depts.length === 1 ? "" : "s"
      }.`,
    );
    setStage("saved");
    return true;
  }

  const remainingIssues = inspectRows(mappedRows);
  const issuesLeft = remainingIssues.length;
  const canSave = mappedRows.length > 0 && issuesLeft === 0 && !busy;

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
          Replace your saved dataset with a CSV or Excel file. Choose AI-assisted
          or fully manual preparation.
        </p>
      </header>

      <div className="mb-5">
        <FilterBar
          actionHref="/dashboard"
          actionLabel="← Back to Dashboard"
          actionIcon="back"
        />
      </div>

      <Card className="mb-5 max-w-xl p-5">
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
        {fileName ? (
          <p className="mt-3 text-sm text-foreground">
            {fileName}
            {rawRows.length > 0 ? ` · ${rawRows.length} rows` : ""}
          </p>
        ) : null}
        {parseError ? <p className="mt-3 text-sm text-rag-red">{parseError}</p> : null}
      </Card>

      {rawRows.length > 0 && stage === "choice" ? (
        <ChoiceStep
          fileName={fileName ?? "File"}
          rowCount={rawRows.length}
          onChoose={(next) => void chooseMode(next)}
        />
      ) : null}

      {stage === "mapping" && mode ? (
        <ColumnMappingForm
          headers={headers}
          mapping={mapping}
          loading={mappingLoading}
          busy={busy}
          error={mappingError}
          aiAssisted={mode === "ai"}
          onChange={setMapping}
          onContinue={() => void continueMapping()}
        />
      ) : null}
      {stage === "mapping" && saveError ? (
        <p className="mt-3 max-w-xl text-sm text-rag-red">{saveError}</p>
      ) : null}

      {stage === "ai-fixes" ? (
        <AiFixReview
          loading={aiLoading}
          suggestions={aiSuggestions}
          skipped={aiSkipped}
          onApply={applyAiFixes}
          onSkip={openManualFix}
        />
      ) : null}

      {stage === "manual-fix" ? (
        <div className="space-y-4">
          <ManualFixTable
            rows={mappedRows}
            flaggedIds={flaggedIds}
            onChange={onManualChange}
            onCancel={resetWorking}
          />
          {issuesLeft > 0 ? (
            <p className="text-sm text-rag-red">
              {remainingIssuesMessage(remainingIssues)}
            </p>
          ) : saveError ? (
            <p className="text-sm text-rag-red">{saveError}</p>
          ) : null}
          <div className="max-w-xl">
            <button
              type="button"
              disabled={busy}
              onClick={() => void persistRows(mappedRows)}
              className={navyButtonClass}
            >
              {busy ? "Saving…" : "Save and Continue"}
            </button>
          </div>
        </div>
      ) : null}

      {stage === "ready" ? (
        <div className="mt-5 max-w-xl">
          {saveError ? <p className="mb-3 text-sm text-rag-red">{saveError}</p> : null}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void persistRows(mappedRows)}
            className={navyButtonClass}
          >
            {busy ? "Saving…" : "Save and Continue"}
          </button>
        </div>
      ) : null}

      {stage === "saved" && savedLabel ? (
        <Card className="mt-5 max-w-xl p-5">
          <p className="text-sm text-foreground">{savedLabel}</p>
          <Link href="/dashboard" className={`${toolbarButtonClass} mt-4`}>
            View Dashboard →
          </Link>
        </Card>
      ) : null}

      {audit.length > 0 ? (
        <p className="mt-6 max-w-2xl text-xs leading-5 text-muted">
          {audit.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
