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

export async function persistUploadDraft(draft: UploadDraft): Promise<boolean> {
  writeUploadDraft(draft);
  try {
    const response = await fetch("/api/upload-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadSavedUploadDraft(): Promise<UploadDraft | null> {
  const local = readUploadDraft();
  try {
    const response = await fetch("/api/upload-draft");
    const payload = (await response.json()) as { draft?: UploadDraft | null };
    if (payload.draft) {
      writeUploadDraft(payload.draft);
      return payload.draft;
    }
  } catch {
    // Fall back to the tab cache if the network call fails.
  }
  return local;
}

export async function discardUploadDraft(): Promise<void> {
  clearUploadDraft();
  try {
    await fetch("/api/upload-draft", { method: "DELETE", keepalive: true });
  } catch {
    // The committed dataset is the source of truth after a successful save.
  }
}
