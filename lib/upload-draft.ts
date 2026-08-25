import type { ColumnMapping, RawCsvRow } from "@/lib/csv";
import type { DatasetProfile } from "@/lib/dataset";

export const UPLOAD_DRAFT_KEY = "northstar-upload-draft";

export type UploadDraft = {
  fileName: string;
  headers: string[];
  rawRows: RawCsvRow[];
  mapping: ColumnMapping;
  mode: "ai" | "manual";
  audit: string[];
  flaggedIds: string[];
  kind?: "hr" | "generic";
  profile?: DatasetProfile | null;
  sourceDataRows?: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function writeUploadDraft(draft: UploadDraft): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify(draft));
}

export function readUploadDraft(): UploadDraft | null {
  if (!canUseStorage()) return null;
  const raw = sessionStorage.getItem(UPLOAD_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UploadDraft;
    if (!parsed || !Array.isArray(parsed.headers) || !Array.isArray(parsed.rawRows)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearUploadDraft(): void {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(UPLOAD_DRAFT_KEY);
}
