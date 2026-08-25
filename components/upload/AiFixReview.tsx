"use client";

import { Card } from "@/components/ui/Card";
import { navyButtonClass } from "@/components/upload/upload-ui";
import { toolbarButtonClass } from "@/components/filters/FilterBar";
export type SuggestedFix = {
  field: string;
  original: string;
  suggested: string;
};

export function AiFixReview({
  loading,
  suggestions,
  skipped,
  onApply,
  onSkip,
}: {
  loading: boolean;
  suggestions: SuggestedFix[];
  skipped: number;
  onApply: () => void;
  onSkip: () => void;
}) {
  return (
    <Card className="max-w-xl p-5">
      <h2 className="text-base font-semibold text-foreground">
        Suggested value fixes
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Only failing values were sent to the AI, never full rows. Confirm before
        anything is applied.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted">Suggesting fixes…</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No confident AI fixes. Continue to the manual editor for remaining
          cells.
        </p>
      ) : (
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
          {suggestions.map((fix) => (
            <li
              key={`${fix.field}-${fix.original}`}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <p className="text-xs font-medium text-muted">{fix.field}</p>
              <p className="mt-1 text-foreground">
                <span className="text-rag-red">{fix.original || "(empty)"}</span>
                <span className="mx-2 text-muted">→</span>
                <span>{fix.suggested}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {skipped > 0 && !loading ? (
        <p className="mt-3 text-xs text-muted">
          {skipped} value{skipped === 1 ? "" : "s"} left for the manual editor.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || suggestions.length === 0}
          onClick={onApply}
          className={navyButtonClass}
        >
          Apply these fixes
        </button>
        <button type="button" disabled={loading} onClick={onSkip} className={toolbarButtonClass}>
          Skip AI fixes
        </button>
      </div>
    </Card>
  );
}
