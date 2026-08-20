import { getGrokApiKey } from "@/lib/grok";
import {
  REQUIRED_HEADERS,
  sanitizeColumnMapping,
  type RequiredHeader,
} from "@/lib/csv";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4.6";
const MAX_HEADERS = 80;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mappingPayload(mapping: Record<RequiredHeader, string>) {
  const payload: Record<RequiredHeader, string> = { ...mapping };
  for (const field of REQUIRED_HEADERS) {
    if (!payload[field]) payload[field] = "not found";
  }
  return payload;
}

export async function POST(request: Request) {
  let body: { headers?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.headers)) {
    return Response.json({ error: "headers_required" }, { status: 400 });
  }

  const headers = body.headers
    .filter((header): header is string => typeof header === "string")
    .map((header) => header.trim())
    .filter((header) => header.length > 0)
    .slice(0, MAX_HEADERS);

  if (headers.length === 0) {
    return Response.json({ error: "headers_required" }, { status: 400 });
  }

  const fallback = sanitizeColumnMapping({}, headers);
  const apiKey = getGrokApiKey();
  if (!apiKey) {
    return Response.json(mappingPayload(fallback));
  }

  const system = [
    "You map CSV column headers to required HR analytics fields.",
    "You are given ONLY header names. You will never receive data values, and you must not ask for them.",
    "Match by naming only. If a match is ambiguous, return \"not found\".",
    "Do not invent header names. Use the exact header string from the provided list, or \"not found\".",
    `Required fields: ${REQUIRED_HEADERS.join(", ")}.`,
    "Return JSON only, with exactly those keys.",
  ].join(" ");

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
          {
            role: "user",
            content: JSON.stringify({ headers }),
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      error?: string | { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      return Response.json(mappingPayload(fallback));
    }

    const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = extractJsonObject(content) ?? {};
    const mapping = sanitizeColumnMapping(parsed, headers);
    return Response.json(mappingPayload(mapping));
  } catch {
    return Response.json(mappingPayload(fallback));
  }
}
