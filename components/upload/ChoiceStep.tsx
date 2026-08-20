"use client";

import { Pencil, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { navyButtonClass } from "@/components/upload/upload-ui";
import { toolbarButtonClass } from "@/components/filters/FilterBar";

export function ChoiceStep({
  fileName,
  rowCount,
  onChoose,
}: {
  fileName: string;
  rowCount: number;
  onChoose: (mode: "ai" | "manual") => void;
}) {
  return (
    <Card className="max-w-xl p-5">
      <p className="text-sm font-medium text-foreground">{fileName}</p>
      <p className="mt-1 text-xs text-muted">{rowCount} rows parsed</p>
      <h2 className="mt-5 text-base font-semibold text-foreground">
        How would you like to prepare this file?
      </h2>
      <div className="mt-4 space-y-3">
        <button
          type="button"
          onClick={() => onChoose("ai")}
          className={`${navyButtonClass} h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left`}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Sparkles size={16} />
            Let AI handle it
          </span>
          <span className="text-xs font-normal text-white/80">
            AI maps columns and fixes errors it can, with your review before
            anything is applied.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose("manual")}
          className={`${toolbarButtonClass} h-auto w-full flex-col items-start gap-1 px-4 py-3 text-left`}
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Pencil size={16} className="text-navy" />
            I&apos;ll do it manually
          </span>
          <span className="text-xs font-normal text-muted">
            You map columns and fix errors yourself, with full editing tools.
          </span>
        </button>
      </div>
    </Card>
  );
}
