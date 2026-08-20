"use client";

import { REQUIRED_HEADERS, isMappingComplete, type ColumnMapping } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { navyButtonClass, selectClass } from "@/components/upload/upload-ui";

export function ColumnMappingForm({
  headers,
  mapping,
  loading,
  busy,
  error,
  aiAssisted,
  onChange,
  onContinue,
}: {
  headers: string[];
  mapping: ColumnMapping;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  aiAssisted: boolean;
  onChange: (next: ColumnMapping) => void;
  onContinue: () => void;
}) {
  const ready = isMappingComplete(mapping, headers);
  const preview =
    headers.length > 0
      ? headers.slice(0, 10).join(", ") + (headers.length > 10 ? "…" : "")
      : "";

  return (
    <Card className="max-w-xl p-5">
      <h2 className="text-base font-semibold text-foreground">Column mapping</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {aiAssisted
          ? "Review the suggested matches. This only renames columns — your data values are never changed or sent to the AI."
          : "Match each required field to a column from the file. No AI is used in this step."}
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Matching column names…</p>
      ) : null}
      <div className="mt-5 space-y-3">
          {error ? (
            <div className="space-y-1">
              <p className="text-sm text-rag-red">{error}</p>
              {preview ? (
                <p className="text-xs leading-5 text-muted">
                  Detected columns: {preview}
                </p>
              ) : null}
            </div>
          ) : null}
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
                onChange={(event) =>
                  onChange({ ...mapping, [field]: event.target.value })
                }
                className={selectClass}
                disabled={loading}
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
          <button
            type="button"
            disabled={!ready || busy}
            onClick={onContinue}
            className={navyButtonClass}
          >
            {busy ? "Saving…" : "Continue with this mapping"}
          </button>
      </div>
    </Card>
  );
}
