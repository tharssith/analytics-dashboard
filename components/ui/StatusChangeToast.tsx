"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/lib/filters-context";
import type { RagStatus } from "@/lib/types";

const STATUS_WORD: Record<RagStatus | "neutral", string> = {
  green: "green",
  amber: "amber",
  red: "red",
  neutral: "unchanged",
};

const ACCENT: Record<RagStatus | "neutral", string> = {
  green: "border-rag-green",
  amber: "border-rag-amber",
  red: "border-rag-red",
  neutral: "border-navy",
};

export function StatusChangeToast() {
  const { kpiStatusChanges, clearKpiStatusChanges } = useFilters();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState<RagStatus | "neutral">("green");

  useEffect(() => {
    if (kpiStatusChanges.length === 0) return;

    const clauses = kpiStatusChanges.map(
      (change) =>
        `${change.label} is now ${STATUS_WORD[change.status]}`,
    );
    setMessage(
      `Data updated — ${clauses.join(". ")}. Ask the AI panel to see an updated answer.`,
    );
    setAccent(kpiStatusChanges[0].status);
    setVisible(true);

    const hide = window.setTimeout(() => setVisible(false), 4000);
    const clear = window.setTimeout(() => clearKpiStatusChanges(), 4300);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(clear);
    };
  }, [kpiStatusChanges, clearKpiStatusChanges]);

  if (!visible || !message) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-50 max-w-sm xl:bottom-6">
      <div
        className={`rounded-md border-l-4 bg-white px-3 py-3 text-xs leading-5 text-foreground ring-1 ring-border transition-opacity duration-200 ${ACCENT[accent]}`}
      >
        {message}
      </div>
    </div>
  );
}
