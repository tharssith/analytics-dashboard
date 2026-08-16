import { getGrokApiKey } from "@/lib/grok";
import { buildQaPrompt } from "@/lib/qa-prompt";
import { buildQaDashboardValues } from "@/lib/report";
import type { HrRecord } from "@/lib/types";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4.6";

function isConfigured(): boolean {
  return Boolean(getGrokApiKey());
}

function isHrRecord(value: unknown): value is HrRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.month === "string" &&
    typeof row.department === "string" &&
    typeof row.headcount === "number"
  );
}

function grokErrorMessage(payload: {
  error?: string | { message?: string };
}): string {
  const rawError = payload.error;
  if (typeof rawError === "string") return rawError;
  return rawError?.message ?? "grok_request_failed";
}

export async function GET() {
  return Response.json({ configured: isConfigured() });
}

export async function POST(request: Request) {
  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return Response.json({ error: "missing_key" }, { status: 503 });
  }

  let body: {
    question?: unknown;
    dateRange?: unknown;
    department?: unknown;
    records?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "missing_question" }, { status: 400 });
  }

  const dateRange = typeof body.dateRange === "string" ? body.dateRange : "";
  const department =
    typeof body.department === "string" ? body.department : "All";
  const records = Array.isArray(body.records)
    ? body.records.filter(isHrRecord)
    : [];
  const values = buildQaDashboardValues(records);

  const system = buildQaPrompt({
    dateRange,
    department,
    ...values,
    filteredData: records,
    userQuestion: question,
  });

  try {
    const response = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
      }),
    });

    const payload = (await response.json()) as {
      error?: string | { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      return Response.json(
        { error: grokErrorMessage(payload) },
        { status: 502 },
      );
    }

    const answer = payload.choices?.[0]?.message?.content?.trim() ?? "";
    return Response.json({ answer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "grok_request_failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
