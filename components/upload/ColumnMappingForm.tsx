"use client";

import { REQUIRED_HEADERS, isMappingComplete, type ColumnMapping } from "@/lib/csv";
import { Card } from "@/components/ui/Card";
import { navyButtonClass, selectClass } from "@/components/upload/upload-ui";

export function ColumnMappingForm({
  headers,
  mapping,
  loading,
  aiAssisted,
  onChange,
  onContinue,
}: {
  headers: string[];
  mapping: ColumnMapping;
  loading?: boolean;
  aiAssisted: boolean;
  onChange: (next: ColumnMapping) => void;
  onContinue: () => void;
}) {
  const ready = isMappingComplete(mapping, headers);

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
      ) : (
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
                onChange={(event) =>
                  onChange({ ...mapping, [field]: event.target.value })
                }
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
          <button
            type="button"
            disabled={!ready}
            onClick={onContinue}
            className={navyButtonClass}
          >
            Continue with this mapping
          </button>
        </div>
      )}
    </Card>
  );
}
