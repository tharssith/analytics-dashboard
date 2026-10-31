"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpreadsheetEditor } from "@/components/upload/SpreadsheetEditor";
import {
  REQUIRED_HEADERS,
  applyColumnMapping,
  emptyMapping,
  mappingFromExactHeaders,
  recordsToRawRows,
  type RawCsvRow,
} from "@/lib/csv";
import { inferRoles } from "@/lib/dataset";
import { useFilters } from "@/lib/filters-context";
import { registerFlusher } from "@/lib/persist-queue";
import { persistUploadDraft } from "@/lib/upload-draft";
import {
  inspectGenericRows,
  inspectRows,
  mappedRowsFromRaw,
  rowsToRecords,
} from "@/lib/upload-validate";

export function EditDataView() {
  const router = useRouter();
  const {
    loading,
    sourceRecords,
    dataset,
    isHrDashboard,
    replaceSourceRecords,
    replaceDataset,
  } = useFilters();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  const initialized = useRef(false);
  const rowsRef = useRef<RawCsvRow[]>([]);
  const headersRef = useRef<string[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    if (dataset && !isHrDashboard) {
      setHeaders([...dataset.headers]);
      setRows(dataset.rows.map((row) => ({ ...row })));
      initialized.current = true;
      setReady(true);
      return;
    }
    if (isHrDashboard && loading) return;
    setHeaders([...REQUIRED_HEADERS]);
    setRows(recordsToRawRows(sourceRecords));
    initialized.current = true;
    setReady(true);
  }, [dataset, isHrDashboard, loading, sourceRecords]);

  rowsRef.current = rows;
  headersRef.current = headers;

  async function persistCurrent(silent: boolean) {
    const nextRows = rowsRef.current;
    const nextHeaders = headersRef.current;
    if (!isHrDashboard && dataset) {
      await persistUploadDraft({
        fileName: dataset.filename,
        headers: nextHeaders,
        rawRows: nextRows,
        mapping: emptyMapping(),
        mode: "manual",
        audit: [],
        flaggedIds: [],
        kind: "generic",
        profile: dataset,
        sourceDataRows: nextRows.length,
      });
      const issues = inspectGenericRows(nextRows, dataset.timeField);
      if (issues.length > 0) return false;
      const roles = inferRoles(nextHeaders, nextRows);
      const ok = await replaceDataset({
        ...dataset,
        headers: nextHeaders,
        rows: nextRows,
        ...roles,
      });
      if (ok) setAutoSaved(true);
      else if (!silent) setSaveError("Could not save dataset.");
      return ok;
    }
    const mapping = mappingFromExactHeaders(nextHeaders);
    await persistUploadDraft({
      fileName: dataset?.filename ?? "Workforce data",
      headers: nextHeaders,
      rawRows: nextRows,
      mapping,
      mode: "manual",
      audit: [],
      flaggedIds: [],
      kind: "hr",
      sourceDataRows: nextRows.length,
    });
    const mapped = mappedRowsFromRaw(applyColumnMapping(nextRows, mapping));
    const issues = inspectRows(mapped);
    if (issues.length > 0) return false;
    const converted = rowsToRecords(mapped);
    if (converted.errors.length > 0 || converted.records.length !== mapped.length) {
      return false;
    }
    const ok = await replaceSourceRecords(converted.records);
    if (ok) setAutoSaved(true);
    else if (!silent) setSaveError("Could not save records.");
    return ok;
  }

  useEffect(() => {
    return registerFlusher(async () => {
      await persistCurrent(true);
    });
  });

  function queueAutoSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistCurrent(true);
    }, 900);
  }

  async function save() {
    setSaveError(null);
    setBusy(true);
    const ok = await persistCurrent(false);
    setBusy(false);
    if (!ok) {
      if (!saveError) {
        setSaveError("Fix highlighted cells before saving, or just log out — the draft is already kept.");
      }
      return;
    }
    router.push("/analytics");
  }

  if (!ready) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <SpreadsheetEditor
      fileName={dataset?.filename ?? "Workforce data"}
      headers={headers}
      rows={rows}
      mapping={isHrDashboard ? mappingFromExactHeaders(headers) : undefined}
      validateHr={isHrDashboard}
      timeField={isHrDashboard ? null : dataset?.timeField ?? null}
      busy={busy}
      saveError={saveError}
      saveLabel={autoSaved ? "Saved" : "Save"}
      onRowsChange={(next) => {
        setRows(next);
        setSaveError(null);
        queueAutoSave();
      }}
      onHeadersChange={(next) => {
        setHeaders(next);
        queueAutoSave();
      }}
      onCancel={() => router.push("/analytics")}
      onSave={() => void save()}
    />
  );
}
