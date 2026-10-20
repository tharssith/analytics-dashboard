import type { CustomMeasure, SheetSpec } from "@/lib/analysis-workspace";
import type { ProvenanceResult } from "@/lib/provenance";

export type DatasetClaim = {
  id: string;
  createdAt: string;
  metricId: string;
  metricLabel: string;
  kind: ProvenanceResult["kind"];
  filterKey: string;
  statement: string;
  value: number;
  excludeKValue: number | null;
  reverseStory: boolean;
  swingRowIds: string[];
  swingLabels: string[];
  storyBefore: string;
  spec?: SheetSpec | null;
  custom?: CustomMeasure[];
};

export type ClaimCheck = {
  claim: DatasetClaim;
  stillTrue: boolean;
  currentStatement: string;
  message: string;
};

export function claimFromProvenance(
  provenance: ProvenanceResult,
  extra?: Pick<DatasetClaim, "spec" | "custom">,
): DatasetClaim {
  const swing = provenance.swingRows.map((row) => row.label);
  const statement = `${provenance.metricLabel} is ${provenance.formatted}. ${provenance.narrative}`;
  return {
    id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    metricId: provenance.metricId,
    metricLabel: provenance.metricLabel,
    kind: provenance.kind,
    filterKey: provenance.filterKey,
    statement,
    value: provenance.value,
    excludeKValue: provenance.excludeKValue,
    reverseStory: provenance.reverseStory,
    swingRowIds: provenance.swingRows.map((row) => row.id),
    swingLabels: swing,
    storyBefore: provenance.storyBefore,
    spec: extra?.spec ?? null,
    custom: extra?.custom,
  };
}

export function checkClaim(claim: DatasetClaim, next: ProvenanceResult | null): ClaimCheck {
  if (!next) {
    return {
      claim,
      stillTrue: false,
      currentStatement: "This metric is no longer in the file.",
      message: `Last claim broke: “${claim.metricLabel}” is no longer in the uploaded file.`,
    };
  }

  const overlapIds = next.swingRows.some((row) => claim.swingRowIds.includes(row.id));
  const overlapLabels = next.swingRows.some((row) => claim.swingLabels.includes(row.label));
  const relative =
    Math.abs(next.value - claim.value) / Math.max(1, Math.abs(claim.value));
  const stillTrue =
    relative < 0.2 &&
    claim.reverseStory === next.reverseStory &&
    (overlapIds || overlapLabels || claim.swingLabels.length === 0);

  const currentStatement = `${next.metricLabel} is ${next.formatted}. ${next.narrative}`;
  if (stillTrue) {
    return {
      claim,
      stillTrue: true,
      currentStatement,
      message: `Last claim still holds: ${claim.metricLabel} is still ${next.formatted}.`,
    };
  }
  return {
    claim,
    stillTrue: false,
    currentStatement,
    message: `Last week: ${claim.storyBefore}. Today: ${next.storyBefore}. “${claim.metricLabel}” is no longer the same story.`,
  };
}

export function asClaim(value: unknown): DatasetClaim | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.statement !== "string") return null;
  if (typeof row.metricId !== "string" || typeof row.metricLabel !== "string") return null;
  if (row.kind !== "kpi" && row.kind !== "generic" && row.kind !== "viz") return null;
  if (typeof row.value !== "number") return null;
  return {
    id: row.id,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    metricId: row.metricId,
    metricLabel: row.metricLabel,
    kind: row.kind,
    filterKey: typeof row.filterKey === "string" ? row.filterKey : "",
    statement: row.statement,
    value: row.value,
    excludeKValue: typeof row.excludeKValue === "number" ? row.excludeKValue : null,
    reverseStory: Boolean(row.reverseStory),
    swingRowIds: Array.isArray(row.swingRowIds)
      ? row.swingRowIds.filter((item): item is string => typeof item === "string")
      : [],
    swingLabels: Array.isArray(row.swingLabels)
      ? row.swingLabels.filter((item): item is string => typeof item === "string")
      : [],
    storyBefore: typeof row.storyBefore === "string" ? row.storyBefore : "",
    spec: row.spec && typeof row.spec === "object" ? (row.spec as DatasetClaim["spec"]) : null,
    custom: Array.isArray(row.custom) ? (row.custom as DatasetClaim["custom"]) : undefined,
  };
}
