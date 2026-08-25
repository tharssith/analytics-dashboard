"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpreadsheetEditor } from "@/components/upload/SpreadsheetEditor";
import {
  REQUIRED_HEADERS,
  applyColumnMapping,
  mappingFromExactHeaders,
  recordsToRawRows,
  type RawCsvRow,
} from "@/lib/csv";
import { inferRoles } from "@/lib/dataset";
import { useFilters } from "@/lib/filters-context";
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
  const initialized = useRef(false);

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

  async function save() {
    setSaveError(null);
    if (!isHrDashboard && dataset) {
      const issues = inspectGenericRows(rows, dataset.timeField);
      if (issues.length > 0) {
        setSaveError(
          `${issues.length} cell${issues.length === 1 ? "" : "s"} still fail validation. Fix the highlighted cells before saving.`,
        );
        return;
      }
      const roles = inferRoles(headers, rows);
      setBusy(true);
      const ok = await replaceDataset({
        ...dataset,
        headers,
        rows,
        ...roles,
      });
      setBusy(false);
      if (!ok) {
        setSaveError("Could not save dataset.");
        return;
      }
      router.push("/analytics");
      return;
    }

    const mapping = mappingFromExactHeaders(headers);
    const mapped = mappedRowsFromRaw(applyColumnMapping(rows, mapping));
    const issues = inspectRows(mapped);
    if (issues.length > 0) {
      setSaveError(
        `${issues.length} cell${issues.length === 1 ? "" : "s"} still fail validation. Fix the highlighted cells before saving.`,
      );
      return;
    }
    const converted = rowsToRecords(mapped);
    if (converted.errors.length > 0) {
      setSaveError(converted.errors[0] ?? "Some rows still fail validation.");
      return;
    }
    if (converted.records.length !== mapped.length) {
      setSaveError(
        `${mapped.length - converted.records.length} rows were skipped due to errors. Fix the highlighted cells before saving.`,
      );
      return;
    }
    setBusy(true);
    const ok = await replaceSourceRecords(converted.records);
    setBusy(false);
    if (!ok) {
      setSaveError("Could not save records.");
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
      saveLabel="Save"
      onRowsChange={(next) => {
        setRows(next);
        setSaveError(null);
      }}
      onHeadersChange={setHeaders}
      onCancel={() => router.push("/analytics")}
      onSave={() => void save()}
    />
  );
}
