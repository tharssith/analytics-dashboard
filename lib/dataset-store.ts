import type { RawCsvRow } from "@/lib/csv";
import {
  DEFAULT_HR_PROFILE,
  isDatasetKind,
  type DatasetKind,
  type DatasetProfile,
  type StoredDataset,
} from "@/lib/dataset";
import { createClient } from "@/lib/supabase/server";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRows(value: unknown): RawCsvRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is RawCsvRow => Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}

export function rowToDataset(row: Record<string, unknown>): StoredDataset {
  const kind = isDatasetKind(row.kind) ? row.kind : "generic";
  return {
    filename: typeof row.filename === "string" ? row.filename : "upload",
    kind,
    typeFromName: isDatasetKind(row.type_from_name) ? row.type_from_name : kind,
    typeFromHeaders: isDatasetKind(row.type_from_headers)
      ? row.type_from_headers
      : kind,
    nameHeaderMatch: Boolean(row.name_header_match),
    reason: typeof row.reason === "string" ? row.reason : "",
    timeField: typeof row.time_field === "string" ? row.time_field : null,
    categoryField: typeof row.category_field === "string" ? row.category_field : null,
    metricFields: asStringArray(row.metric_fields),
    headers: asStringArray(row.headers),
    rows: asRows(row.rows),
  };
}

export function datasetPayload(dataset: StoredDataset) {
  return {
    filename: dataset.filename,
    kind: dataset.kind,
    typeFromName: dataset.typeFromName,
    typeFromHeaders: dataset.typeFromHeaders,
    nameHeaderMatch: dataset.nameHeaderMatch,
    reason: dataset.reason,
    timeField: dataset.timeField,
    categoryField: dataset.categoryField,
    metricFields: dataset.metricFields,
    headers: dataset.headers,
    rows: dataset.rows,
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: "Sign in required." };
  }
  return { supabase, user, error: null };
}

export async function getStoredDataset(): Promise<{
  dataset: StoredDataset | null;
  error: string | null;
}> {
  try {
    const { supabase, user, error: authError } = await requireUser();
    if (!user) return { dataset: null, error: authError };
    const { data, error } = await supabase
      .from("user_datasets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      if (error.code === "42P01") return { dataset: null, error: null };
      return { dataset: null, error: error.message };
    }
    if (!data) return { dataset: null, error: null };
    return { dataset: rowToDataset(data as Record<string, unknown>), error: null };
  } catch (error) {
    return {
      dataset: null,
      error: error instanceof Error ? error.message : "Could not load dataset.",
    };
  }
}

export async function replaceStoredDataset(
  dataset: StoredDataset,
): Promise<{ dataset: StoredDataset | null; error: string | null }> {
  try {
    const { supabase, user, error: authError } = await requireUser();
    if (!user) return { dataset: null, error: authError };
    const payload = datasetPayload(dataset);
    const { error } = await supabase.rpc("replace_user_dataset", { payload });
    if (error) {
      const { error: upsertError } = await supabase.from("user_datasets").upsert({
        user_id: user.id,
        filename: payload.filename,
        kind: payload.kind,
        type_from_name: payload.typeFromName,
        type_from_headers: payload.typeFromHeaders,
        name_header_match: payload.nameHeaderMatch,
        reason: payload.reason,
        time_field: payload.timeField,
        category_field: payload.categoryField,
        metric_fields: payload.metricFields,
        headers: payload.headers,
        rows: payload.rows,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) {
        if (upsertError.code === "42P01") {
          return { dataset, error: null };
        }
        return { dataset: null, error: upsertError.message };
      }
    }
    return { dataset, error: null };
  } catch (error) {
    return {
      dataset: null,
      error: error instanceof Error ? error.message : "Could not save dataset.",
    };
  }
}

export function hrProfile(): DatasetProfile {
  return { ...DEFAULT_HR_PROFILE };
}

export type { DatasetKind };
