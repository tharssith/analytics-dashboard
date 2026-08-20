"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { FilterBar, toolbarButtonClass } from "@/components/filters/FilterBar";
import { Card } from "@/components/ui/Card";
import { cloneRecords, dataset } from "@/lib/data";
import { useFilters } from "@/lib/filters-context";
import type { HrRecord } from "@/lib/types";

type NumericKey =
  | "headcount"
  | "target_headcount"
  | "new_hires"
  | "attrition_count"
  | "time_to_hire_days"
  | "referral_pct"
  | "job_board_pct"
  | "agency_pct";

const COLUMNS: { key: NumericKey | "month" | "department"; label: string }[] = [
  { key: "month", label: "month" },
  { key: "department", label: "department" },
  { key: "headcount", label: "headcount" },
  { key: "target_headcount", label: "target_headcount" },
  { key: "new_hires", label: "new_hires" },
  { key: "attrition_count", label: "attrition_count" },
  { key: "time_to_hire_days", label: "time_to_hire_days" },
  { key: "referral_pct", label: "referral_pct" },
  { key: "job_board_pct", label: "job_board_pct" },
  { key: "agency_pct", label: "agency_pct" },
];

function rowKey(record: HrRecord): string {
  return `${record.month}::${record.department}`;
}

function readValue(record: HrRecord, key: NumericKey): number | null {
  if (key === "referral_pct") return record.source_of_hire.referral_pct;
  if (key === "job_board_pct") return record.source_of_hire.job_board_pct;
  if (key === "agency_pct") return record.source_of_hire.agency_pct;
  return record[key];
}

function writeValue(record: HrRecord, key: NumericKey, value: number | null): HrRecord {
  if (key === "referral_pct" || key === "job_board_pct" || key === "agency_pct") {
    return {
      ...record,
      source_of_hire: { ...record.source_of_hire, [key]: value ?? 0 },
    };
  }
  if (key === "time_to_hire_days") {
    return { ...record, time_to_hire_days: value };
  }
  return { ...record, [key]: value ?? 0 };
}

function sourceSum(record: HrRecord): number {
  const { referral_pct, job_board_pct, agency_pct } = record.source_of_hire;
  return referral_pct + job_board_pct + agency_pct;
}

function NumericCell({
  value,
  dirty,
  allowEmpty,
  onCommit,
}: {
  value: number | null;
  dirty: boolean;
  allowEmpty?: boolean;
  onCommit: (next: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  function startEdit() {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (allowEmpty && trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onCommit(parsed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(value == null ? "" : String(value));
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className={`block w-full rounded-sm px-2 py-1.5 text-left text-sm tabular-nums transition-colors duration-150 hover:bg-background/80 ${
          dirty ? "bg-rag-amber-bg" : ""
        }`}
      >
        {value == null ? "—" : value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={`w-full rounded-sm border border-navy bg-white px-2 py-1.5 text-sm tabular-nums outline-none ${
        dirty ? "bg-rag-amber-bg" : ""
      }`}
    />
  );
}

export function EditDataView() {
  const { sourceRecords, saveSourceRecords, resetSourceRecords } = useFilters();
  const [draft, setDraft] = useState<HrRecord[]>(() => cloneRecords(sourceRecords));
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      [...draft].sort(
        (a, b) =>
          a.month.localeCompare(b.month) || a.department.localeCompare(b.department),
      ),
    [draft],
  );

  function markDirty(record: HrRecord, key: NumericKey) {
    setDirty((current) => new Set(current).add(`${rowKey(record)}:${key}`));
  }

  function updateRecord(target: HrRecord, key: NumericKey, value: number | null) {
    markDirty(target, key);
    setDraft((current) =>
      current.map((record) =>
        rowKey(record) === rowKey(target) ? writeValue(record, key, value) : record,
      ),
    );
  }

  function save() {
    saveSourceRecords(draft);
    setDirty(new Set());
  }

  function reset() {
    const original = cloneRecords();
    resetSourceRecords();
    setDraft(original);
    setDirty(new Set());
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
          {dataset.company.industry}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Edit Data
        </h1>
        <p className="mt-1 text-sm text-muted">
          Changes stay in this session until you save. Saving updates Monitor,
          Diagnose, Predict, and Ask immediately. No database write yet.
        </p>
      </header>

      <div className="mb-5">
        <FilterBar
          actionHref="/analytics"
          actionLabel="← Back to Analytics"
          actionIcon="back"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={dirty.size === 0}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-navy px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save changes
        </button>
        <button type="button" onClick={reset} className={toolbarButtonClass}>
          Reset to original data
        </button>
        <p className="text-xs text-muted">
          {dirty.size === 0
            ? "No unsaved edits"
            : `${dirty.size} unsaved cell${dirty.size === 1 ? "" : "s"}`}
        </p>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-x-auto overflow-y-auto">
          <table className="w-max min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-border">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap px-3 py-3 text-xs font-medium text-muted"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const mix = sourceSum(record);
                const mixOff = Math.abs(mix - 100) > 0.05;
                return (
                  <tr key={rowKey(record)} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-1.5 text-sm text-foreground">{record.month}</td>
                    <td className="px-3 py-1.5 text-sm text-foreground">
                      {record.department}
                    </td>
                    {(
                      [
                        "headcount",
                        "target_headcount",
                        "new_hires",
                        "attrition_count",
                        "time_to_hire_days",
                        "referral_pct",
                        "job_board_pct",
                        "agency_pct",
                      ] as NumericKey[]
                    ).map((key) => (
                      <td key={key} className="min-w-[7rem] px-1 py-1 align-top">
                        <NumericCell
                          value={readValue(record, key)}
                          dirty={dirty.has(`${rowKey(record)}:${key}`)}
                          allowEmpty={key === "time_to_hire_days"}
                          onCommit={(value) => updateRecord(record, key, value)}
                        />
                        {mixOff &&
                        (key === "agency_pct" ||
                          key === "referral_pct" ||
                          key === "job_board_pct") &&
                        key === "agency_pct" ? (
                          <p className="px-2 pb-1 text-[10px] text-rag-amber">
                            Source mix is {mix}, not 100
                          </p>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
