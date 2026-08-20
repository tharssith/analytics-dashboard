import {
  DATASET_KINDS,
  KIND_LABELS,
  buildLocalProfile,
  inferRoles,
  isDatasetKind,
  kindFromFilename,
  kindFromHeaders,
  type DatasetKind,
  type DatasetProfile,
} from "@/lib/dataset";
import { extractJson, getGrokApiKey, GROK_MODEL, XAI_CHAT_URL } from "@/lib/grok";
import type { RawCsvRow } from "@/lib/csv";

export const maxDuration = 30;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export async function POST(request: Request) {
  let body: { filename?: unknown; headers?: unknown; rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename : "upload";
  const headers = asStringArray(body.headers).slice(0, 80);
  const rows = Array.isArray(body.rows)
    ? (body.rows as RawCsvRow[]).slice(0, 25)
    : [];
  const local = buildLocalProfile(filename, headers, rows);
  const apiKey = getGrokApiKey();
  if (!apiKey || headers.length === 0) {
    return Response.json(local);
  }

  const system = [
    "You classify a spreadsheet for an analytics dashboard.",
    "Cross-check the FILE NAME against the COLUMN HEADERS.",
    `Allowed types: ${DATASET_KINDS.join(", ")}.`,
    "Return JSON only with keys: kind, typeFromName, typeFromHeaders, nameHeaderMatch, reason, timeField, categoryField, metricFields.",
    "kind is the best overall type after the cross-check.",
    "nameHeaderMatch is true only if the filename type and header type agree, or one is generic.",
    "timeField, categoryField, metricFields must be exact header strings from the list, or null / [].",
    "Do not invent headers.",
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
        temperature: 0,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              filename,
              headers,
              labels: KIND_LABELS,
              localGuess: {
                typeFromName: kindFromFilename(filename),
                typeFromHeaders: kindFromHeaders(headers),
              },
            }),
          },
        ],
      }),
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) return Response.json(local);
    const parsed = extractJson(payload.choices?.[0]?.message?.content ?? "") as Record<
      string,
      unknown
    > | null;
    if (!parsed) return Response.json(local);
    const kind = isDatasetKind(parsed.kind) ? parsed.kind : local.kind;
    const typeFromName = isDatasetKind(parsed.typeFromName)
      ? parsed.typeFromName
      : local.typeFromName;
    const typeFromHeaders = isDatasetKind(parsed.typeFromHeaders)
      ? parsed.typeFromHeaders
      : local.typeFromHeaders;
    const roles = inferRoles(headers, rows);
    const headerSet = new Set(headers);
    const timeField =
      typeof parsed.timeField === "string" && headerSet.has(parsed.timeField)
        ? parsed.timeField
        : roles.timeField;
    const categoryField =
      typeof parsed.categoryField === "string" && headerSet.has(parsed.categoryField)
        ? parsed.categoryField
        : roles.categoryField;
    const metricFields = asStringArray(parsed.metricFields).filter((field) =>
      headerSet.has(field),
    );
    const profile: DatasetProfile = {
      filename,
      kind,
      typeFromName,
      typeFromHeaders,
      nameHeaderMatch: Boolean(parsed.nameHeaderMatch),
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : local.reason,
      timeField,
      categoryField,
      metricFields: metricFields.length > 0 ? metricFields : roles.metricFields,
      headers,
    };
    return Response.json(profile);
  } catch {
    return Response.json(local);
  }
}
