"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Check, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
import { REQUIRED_HEADERS, type RequiredHeader } from "@/lib/csv";
import {
  checkField,
  failingRowIds,
  inspectRows,
  type CellIssue,
  type MappedRow,
} from "@/lib/upload-validate";

function cellClass(failing: boolean, pending: boolean, editing: boolean): string {
  const base =
    "block w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150";
  if (failing) {
    return `${base} border border-rag-red bg-rag-red-bg ${editing ? "" : "hover:bg-rag-red-bg"}`;
  }
  if (pending) {
    return `${base} border border-rag-amber bg-rag-amber-bg`;
  }
  if (editing) return `${base} border border-navy bg-white`;
  return `${base} border border-transparent hover:bg-background/80`;
}

function EditorCell({
  field,
  value,
  issue,
  onCommit,
}: {
  field: RequiredHeader;
  value: string;
  issue?: CellIssue;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const live = editing ? checkField(field, draft) : issue;
  const failing = Boolean(live);
  const pending = editing && draft !== value && !live;
  const title = live ? `${field} ${live.message}` : undefined;

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft === value) return;
    onCommit(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <button
          type="button"
          title={title}
          onClick={startEdit}
          className={cellClass(Boolean(issue), false, false)}
        >
          <span className="inline-flex items-center gap-1">
            {issue ? <CircleAlert size={12} className="shrink-0 text-rag-red" /> : null}
            {value || "—"}
          </span>
        </button>
        {issue ? (
          <p className="px-2 pb-1 text-[10px] text-rag-red">
            {issue.field} {issue.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <input
      autoFocus
      title={title}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={`${cellClass(failing, pending, true)} tabular-nums`}
    />
  );
}

export function ManualFixTable({
  rows,
  flaggedIds,
  onChange,
  onCancel,
}: {
  rows: MappedRow[];
  flaggedIds: Set<string>;
  onChange: (next: MappedRow[]) => void;
  onCancel: () => void;
}) {
  const issues = useMemo(() => inspectRows(rows), [rows]);
  const issueIndex = useMemo(() => {
    const map = new Map<string, CellIssue>();
    for (const issue of issues) {
      map.set(`${issue.rowId}:${issue.field}`, issue);
    }
    return map;
  }, [issues]);
  const stillFailing = failingRowIds(issues);
  const visible = rows.filter((row) => flaggedIds.has(row.id));
  const resolved = [...flaggedIds].filter((id) => !stillFailing.has(id)).length;

  function commitCell(row: MappedRow, field: RequiredHeader, next: string) {
    onChange(
      rows.map((item) =>
        item.id === row.id
          ? { ...item, cells: { ...item.cells, [field]: next } }
          : item,
      ),
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm text-foreground">
          {resolved} of {flaggedIds.size} flagged rows resolved
        </p>
        <button type="button" onClick={onCancel} className={toolbarButtonClass}>
          Cancel
        </button>
      </div>
      <div className="max-h-[calc(100vh-18rem)] overflow-x-auto overflow-y-auto">
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-border">
              <th className="whitespace-nowrap px-3 py-3 text-xs font-medium text-muted">
                status
              </th>
              {REQUIRED_HEADERS.map((field) => (
                <th
                  key={field}
                  className="whitespace-nowrap px-3 py-3 text-xs font-medium text-muted"
                >
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const rowOk = !stillFailing.has(row.id);
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 align-top">
                    {rowOk ? (
                      <Check size={16} className="text-rag-green" />
                    ) : (
                      <CircleAlert size={16} className="text-rag-red" />
                    )}
                  </td>
                  {REQUIRED_HEADERS.map((field) => {
                    const key = `${row.id}:${field}`;
                    return (
                      <td key={field} className="min-w-[8rem] px-1 py-1 align-top">
                        <EditorCell
                          field={field}
                          value={row.cells[field]}
                          issue={issueIndex.get(key)}
                          onCommit={(next) => commitCell(row, field, next)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
