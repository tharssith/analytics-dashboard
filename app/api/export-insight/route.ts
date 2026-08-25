import { requireUserId } from "@/lib/auth-user";
import {
  extractJson,
  getGrokApiKey,
  GROK_MODEL,
  XAI_CHAT_URL,
} from "@/lib/grok";
import type { ExportInsight } from "@/lib/export-model";

export const maxDuration = 30;

function asInsight(value: unknown): ExportInsight | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.prediction !== "string" || !row.prediction.trim()) return null;
  const outlook =
    row.outlook === "improving" || row.outlook === "declining" || row.outlook === "stable"
      ? row.outlook
      : "stable";
  const nextPeriodPct =
    typeof row.nextPeriodPct === "number" && Number.isFinite(row.nextPeriodPct)
      ? row.nextPeriodPct
      : null;
  const drivers = Array.isArray(row.drivers)
    ? row.drivers.filter((item): item is string => typeof item === "string").slice(0, 6)
    : [];
  return {
    prediction: row.prediction.trim(),
    outlook,
    nextPeriodPct,
    drivers,
  };
}

export async function POST(request: Request) {
  const session = await requireUserId();
  if (session.error) {
    return Response.json({ error: session.error }, { status: 401 });
  }

  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return Response.json({ error: "missing_key" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const system = `You are a financial analyst writing a short export report for Cairn.
Use only the numbers in the JSON. Do not invent columns or rows.
Decide profit vs loss from the provided outcome.
Name the percentage clearly.
Differentiate ups and downs with their period labels and percents.
Mention the file scale (micro/small/medium/large/enterprise and value unit) so a reader knows how big the move is.
Return JSON only:
{"prediction":"2-4 sentences","outlook":"improving"|"declining"|"stable","nextPeriodPct":number,"drivers":["..."]}`;

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
          { role: "user", content: JSON.stringify(body) },
        ],
      }),
    });
    const payload = (await response.json()) as {
      error?: string | { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) {
      const raw = payload.error;
      const message = typeof raw === "string" ? raw : raw?.message ?? "grok_request_failed";
      return Response.json({ error: message }, { status: 502 });
    }
    const insight = asInsight(extractJson(payload.choices?.[0]?.message?.content ?? ""));
    if (!insight) {
      return Response.json({ error: "invalid_insight" }, { status: 502 });
    }
    return Response.json({ insight });
  } catch (error) {
    const message = error instanceof Error ? error.message : "grok_request_failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
