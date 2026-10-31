import { NextResponse } from "next/server";
import { clearSavedDraft, getSavedDraft, saveDraft } from "@/lib/draft-store";
import type { UploadDraft } from "@/lib/upload-draft";

function asDraft(value: unknown): UploadDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as UploadDraft;
  if (typeof row.fileName !== "string") return null;
  if (!Array.isArray(row.headers) || !Array.isArray(row.rawRows)) return null;
  return row;
}

export async function GET() {
  const result = await getSavedDraft();
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  return NextResponse.json({ draft: result.draft, error: result.error });
}

export async function POST(request: Request) {
  let body: { draft?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const draft = asDraft(body.draft);
  if (!draft) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }
  const result = await saveDraft(draft);
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (result.error || !result.draft) {
    return NextResponse.json({ error: result.error ?? "Save failed." }, { status: 500 });
  }
  return NextResponse.json({ draft: result.draft });
}

export async function DELETE() {
  const result = await clearSavedDraft();
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
