import { getGrokApiKey, GROK_MODEL, XAI_CHAT_URL, extractJson } from "@/lib/grok";
import {
  REQUIRED_HEADERS,
  sanitizeColumnMapping,
  type RequiredHeader,
} from "@/lib/csv";

const MAX_HEADERS = 80;

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
          { role: "user", content: JSON.stringify({ headers }) },
        ],
      }),
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) return Response.json(mappingPayload(fallback));
    const parsed = extractJson(payload.choices?.[0]?.message?.content ?? "");
    const object =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return Response.json(
      mappingPayload(sanitizeColumnMapping(object, headers)),
    );
  } catch {
    return Response.json(mappingPayload(fallback));
  }
}
