import { NextResponse } from "next/server";
import { getStoredDataset, replaceStoredDataset } from "@/lib/dataset-store";
import { isDatasetKind, type StoredDataset } from "@/lib/dataset";
import type { RawCsvRow } from "@/lib/csv";

function asDataset(value: unknown): StoredDataset | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!isDatasetKind(row.kind) || !Array.isArray(row.headers) || !Array.isArray(row.rows)) {
    return null;
  }
  return {
    filename: typeof row.filename === "string" ? row.filename : "upload",
    kind: row.kind,
    typeFromName: isDatasetKind(row.typeFromName) ? row.typeFromName : row.kind,
    typeFromHeaders: isDatasetKind(row.typeFromHeaders) ? row.typeFromHeaders : row.kind,
    nameHeaderMatch: Boolean(row.nameHeaderMatch),
    reason: typeof row.reason === "string" ? row.reason : "",
    timeField: typeof row.timeField === "string" ? row.timeField : null,
    categoryField: typeof row.categoryField === "string" ? row.categoryField : null,
    metricFields: Array.isArray(row.metricFields)
      ? row.metricFields.filter((item): item is string => typeof item === "string")
      : [],
    headers: row.headers.filter((item): item is string => typeof item === "string"),
    rows: row.rows.filter(
      (item): item is RawCsvRow => Boolean(item) && typeof item === "object",
    ),
  };
}

export async function GET() {
  const result = await getStoredDataset();
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  return NextResponse.json({ dataset: result.dataset, error: result.error });
}

export async function POST(request: Request) {
  let body: { dataset?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const dataset = asDataset(body.dataset);
  if (!dataset) {
    return NextResponse.json({ error: "Invalid dataset." }, { status: 400 });
  }
  const result = await replaceStoredDataset(dataset);
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (result.error || !result.dataset) {
    return NextResponse.json({ error: result.error ?? "Save failed." }, { status: 500 });
  }
  return NextResponse.json({ dataset: result.dataset });
}
