import type { RawCsvRow } from "@/lib/csv";
import { requireUserId } from "@/lib/auth-user";
import { getSql, isNeonConfigured } from "@/lib/db";
import {
  DEFAULT_HR_PROFILE,
  isDatasetKind,
  type DatasetKind,
  type DatasetProfile,
  type StoredDataset,
} from "@/lib/dataset";

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

type DatasetRow = {
  filename: string;
  kind: string;
  type_from_name: string;
  type_from_headers: string;
  name_header_match: boolean;
  reason: string | null;
  time_field: string | null;
  category_field: string | null;
  metric_fields: unknown;
  headers: unknown;
  rows: unknown;
};

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

function fromDbRow(row: DatasetRow): StoredDataset {
  return rowToDataset(row as unknown as Record<string, unknown>);
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

function publicError(error: unknown): string {
  if (!isNeonConfigured()) {
    return "Neon is not configured. Set DATABASE_URL on Vercel, then redeploy.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not load dataset from Neon.";
}

export async function getStoredDataset(): Promise<{
  dataset: StoredDataset | null;
  error: string | null;
}> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { dataset: null, error: authError };

    const sql = await getSql();
    const rows = (await sql`
      select * from public.user_datasets where user_id = ${userId} limit 1
    `) as DatasetRow[];
    if (rows[0]) return { dataset: fromDbRow(rows[0]), error: null };
    return { dataset: null, error: null };
  } catch (error) {
    return { dataset: null, error: publicError(error) };
  }
}

export async function replaceStoredDataset(
  dataset: StoredDataset,
): Promise<{ dataset: StoredDataset | null; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { dataset: null, error: authError };

    const payload = datasetPayload(dataset);
    const sql = await getSql();
    await sql`
      insert into public.user_datasets (
        user_id, filename, kind, type_from_name, type_from_headers,
        name_header_match, reason, time_field, category_field,
        metric_fields, headers, rows, updated_at
      )
      values (
        ${userId},
        ${payload.filename},
        ${payload.kind},
        ${payload.typeFromName},
        ${payload.typeFromHeaders},
        ${payload.nameHeaderMatch},
        ${payload.reason},
        ${payload.timeField},
        ${payload.categoryField},
        ${JSON.stringify(payload.metricFields)}::jsonb,
        ${JSON.stringify(payload.headers)}::jsonb,
        ${JSON.stringify(payload.rows)}::jsonb,
        now()
      )
      on conflict (user_id) do update set
        filename = excluded.filename,
        kind = excluded.kind,
        type_from_name = excluded.type_from_name,
        type_from_headers = excluded.type_from_headers,
        name_header_match = excluded.name_header_match,
        reason = excluded.reason,
        time_field = excluded.time_field,
        category_field = excluded.category_field,
        metric_fields = excluded.metric_fields,
        headers = excluded.headers,
        rows = excluded.rows,
        updated_at = now()
    `;
    return { dataset, error: null };
  } catch (error) {
    return { dataset: null, error: publicError(error) };
  }
}

export function hrProfile(): DatasetProfile {
  return { ...DEFAULT_HR_PROFILE };
}

export type { DatasetKind };
