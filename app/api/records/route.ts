import { NextResponse } from "next/server";
import {
  getOrSeedHrRecords,
  replaceHrRecords,
  resetHrRecords,
  updateHrRecord,
} from "@/lib/hr-store";
import type { HrRecord } from "@/lib/types";

function isHrRecord(value: unknown): value is HrRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.month === "string" && typeof row.department === "string";
}

export async function GET() {
  const result = await getOrSeedHrRecords();
  if (result.error && result.records.length === 0) {
    const status = result.error === "Sign in required." ? 401 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ records: result.records, error: result.error });
}

export async function PATCH(request: Request) {
  let body: { id?: unknown; record?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || !isHrRecord(body.record)) {
    return NextResponse.json({ error: "Invalid record update." }, { status: 400 });
  }
  const result = await updateHrRecord(id, body.record);
  if (result.error || !result.record) {
    const status = result.error === "Sign in required." ? 401 : 500;
    return NextResponse.json({ error: result.error ?? "Save failed." }, { status });
  }
  return NextResponse.json({ record: result.record });
}

export async function POST(request: Request) {
  let body: { action?: unknown; records?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "reset") {
    const result = await resetHrRecords();
    if (result.error) {
      const status = result.error === "Sign in required." ? 401 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ records: result.records });
  }

  if (body.action === "replace") {
    const records = Array.isArray(body.records)
      ? body.records.filter(isHrRecord)
      : [];
    if (records.length === 0) {
      return NextResponse.json({ error: "No valid rows to upload." }, { status: 400 });
    }
    const result = await replaceHrRecords(records);
    if (result.error) {
      const status = result.error === "Sign in required." ? 401 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ records: result.records });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
