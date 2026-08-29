import type { DatasetKind } from "@/lib/dataset";

export type UploadPrepMode = "ai" | "manual";

export type UploadStage =
  | "choice"
  | "mapping"
  | "roles"
  | "ai-fixes"
  | "ready"
  | "saved";

export function shouldShowChoice(stage: UploadStage, rowCount: number): boolean {
  return stage === "choice" && rowCount > 0;
}

export function stageAfterChoice(kind: DatasetKind | null | undefined): "mapping" | "roles" {
  return !kind || kind === "hr" ? "mapping" : "roles";
}

export function aiUsesHrMapping(
  kind: DatasetKind | null | undefined,
  mappingComplete: boolean,
): boolean {
  return kind === "hr" && mappingComplete;
}
