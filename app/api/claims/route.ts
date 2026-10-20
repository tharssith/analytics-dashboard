import { NextResponse } from "next/server";
import { asClaim } from "@/lib/claims";
import { listClaims, recheckClaims, saveClaim } from "@/lib/claims-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("check") === "1") {
    const result = await recheckClaims();
    if (result.error === "Sign in required.") {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    return NextResponse.json({ checks: result.checks, error: result.error });
  }
  const result = await listClaims();
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  return NextResponse.json({ claims: result.claims, error: result.error });
}

export async function POST(request: Request) {
  let body: { claim?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const claim = asClaim(body.claim);
  if (!claim) {
    return NextResponse.json({ error: "Invalid claim." }, { status: 400 });
  }
  const result = await saveClaim(claim);
  if (result.error === "Sign in required.") {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (result.error || !result.claim) {
    return NextResponse.json({ error: result.error ?? "Save failed." }, { status: 500 });
  }
  return NextResponse.json({ claim: result.claim });
}
