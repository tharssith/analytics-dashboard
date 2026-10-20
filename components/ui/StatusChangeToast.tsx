"use client";

import { useEffect } from "react";
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
  const {
    kpiStatusChanges,
    clearKpiStatusChanges,
    claimAlerts,
    clearClaimAlerts,
  } = useFilters();

  const broken = claimAlerts.filter((item) => !item.stillTrue);
  const claimMessage = claimAlerts.length
    ? (broken.length > 0 ? broken : claimAlerts).map((item) => item.message).join(" ")
    : "";
  const kpiMessage =
    kpiStatusChanges.length === 0
      ? ""
      : `Data updated — ${kpiStatusChanges
          .map((change) => `${change.label} is now ${STATUS_WORD[change.status]}`)
          .join(". ")}. Ask the AI panel to see an updated answer.`;
  const message = claimMessage || kpiMessage;
  const accent: RagStatus | "neutral" = claimMessage
    ? broken.length > 0
      ? "red"
      : "green"
    : (kpiStatusChanges[0]?.status ?? "green");

  useEffect(() => {
    if (!message) return;
    const clear = window.setTimeout(() => {
      clearClaimAlerts();
      clearKpiStatusChanges();
    }, 6000);
    return () => window.clearTimeout(clear);
  }, [message, clearClaimAlerts, clearKpiStatusChanges]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-50 max-w-sm xl:bottom-6">
      <div
        className={`rounded-md border-l-4 bg-white px-3 py-3 text-xs leading-5 text-foreground ring-1 ring-border ${ACCENT[accent]}`}
      >
        {message}
      </div>
    </div>
  );
}
