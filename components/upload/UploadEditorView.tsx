"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SpreadsheetEditor } from "@/components/upload/SpreadsheetEditor";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import {
  applyColumnMapping,
  skippedRowsMessage,
  type RawCsvRow,
} from "@/lib/csv";
import { uniqueDepartments } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import {
  clearUploadDraft,
  readUploadDraft,
  writeUploadDraft,
  type UploadDraft,
} from "@/lib/upload-draft";
import {
  failingRowIds,
  inspectGenericRows,
  inspectRows,
  mappedRowsFromRaw,
  rowsToRecords,
} from "@/lib/upload-validate";

export function UploadEditorView() {
  const router = useRouter();
  const { replaceSourceRecords, replaceDataset } = useFilters();
  const [draft, setDraft] = useState<UploadDraft | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    setDraft(readUploadDraft());
  }, []);

  function updateRows(next: RawCsvRow[]) {
    setDraft((current) => {
      if (!current) return current;
      const generic = current.kind === "generic";
      const issues = generic
        ? inspectGenericRows(next, current.profile?.timeField ?? null)
        : inspectRows(mappedRowsFromRaw(applyColumnMapping(next, current.mapping)));
      const flagged = new Set(current.flaggedIds);
      for (const id of failingRowIds(issues)) flagged.add(id);
      const updated = {
        ...current,
        rawRows: next,
        flaggedIds: [...flagged],
      };
      writeUploadDraft(updated);
      return updated;
    });
    setSaveError(null);
  }

  function updateHeaders(next: string[]) {
    setDraft((current) => {
      if (!current) return current;
      const updated = { ...current, headers: next };
      writeUploadDraft(updated);
      return updated;
    });
  }

  async function save() {
    if (!draft) return;
    const sourceCount = draft.sourceDataRows ?? draft.rawRows.length;
    const skipMessage = skippedRowsMessage(sourceCount, draft.rawRows.length);
    if (skipMessage) {
      setSaveError(skipMessage);
      return;
    }
    if (draft.kind === "generic") {
      if (!draft.profile) {
        setSaveError("This file is missing dataset type details. Upload it again.");
        return;
      }
      const issues = inspectGenericRows(draft.rawRows, draft.profile.timeField);
      if (issues.length > 0) {
        const failing = failingRowIds(issues);
        setDraft((current) => {
          if (!current) return current;
          const flagged = new Set(current.flaggedIds);
          for (const id of failing) flagged.add(id);
          const updated = { ...current, flaggedIds: [...flagged] };
          writeUploadDraft(updated);
          return updated;
        });
        setSaveError(
          `${failing.size} row${failing.size === 1 ? "" : "s"} still fail validation. Fix the highlighted cells before saving.`,
        );
        return;
      }
      setBusy(true);
      const ok = await replaceDataset({
        ...draft.profile,
        filename: draft.fileName,
        rows: draft.rawRows,
      });
      setBusy(false);
      if (!ok) {
        setSaveError("Could not save this dataset.");
        return;
      }
      clearUploadDraft();
      setSavedLabel(
        `Loaded ${draft.rawRows.length} of ${sourceCount} source rows from ${draft.fileName}.`,
      );
      return;
    }
    const mapped = mappedRowsFromRaw(applyColumnMapping(draft.rawRows, draft.mapping));
    const issues = inspectRows(mapped);
    if (issues.length > 0) {
      const failing = failingRowIds(issues);
      setDraft((current) => {
        if (!current) return current;
        const flagged = new Set(current.flaggedIds);
        for (const id of failing) flagged.add(id);
        const updated = { ...current, flaggedIds: [...flagged] };
        writeUploadDraft(updated);
        return updated;
      });
      setSaveError(
        `${failing.size} row${failing.size === 1 ? "" : "s"} still fail validation. Fix the highlighted cells before saving.`,
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
        skippedRowsMessage(mapped.length, converted.records.length) ??
          "Some rows were dropped during conversion.",
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
    const depts = uniqueDepartments(converted.records);
    clearUploadDraft();
    setSavedLabel(
      `Loaded ${converted.records.length} of ${sourceCount} source rows for ${depts.length} department${
        depts.length === 1 ? "" : "s"
      }.`,
    );
  }

  if (draft === undefined) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <Card className="max-w-xl p-5">
          <p className="text-sm text-foreground">No spreadsheet is open. Upload a file first.</p>
          <Link href="/upload" className={`${toolbarButtonClass} mt-4`}>
            Back to Upload
          </Link>
        </Card>
      </div>
    );
  }

  if (savedLabel) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <Card className="max-w-xl p-5">
          <p className="text-sm text-foreground">{savedLabel}</p>
          <Link href="/dashboard" className={`${toolbarButtonClass} mt-4`}>
            View Dashboard →
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <SpreadsheetEditor
      fileName={draft.fileName}
      headers={draft.headers}
      rows={draft.rawRows}
      mapping={draft.mapping}
      flaggedIds={draft.flaggedIds}
      validateHr={draft.kind !== "generic"}
      timeField={draft.kind === "generic" ? draft.profile?.timeField ?? null : null}
      busy={busy}
      saveError={saveError}
      onRowsChange={updateRows}
      onHeadersChange={updateHeaders}
      onCancel={() => {
        clearUploadDraft();
        router.push("/upload");
      }}
      onSave={() => void save()}
    />
  );
}
