import { REQUIRED_HEADERS, type RequiredHeader } from "@/lib/csv";
import { FIELD_RULES } from "@/lib/upload-validate";
import { extractJson, getGrokApiKey, GROK_MODEL, XAI_CHAT_URL } from "@/lib/grok";

const MAX_VALUES = 80;

type FixPair = { original: string; suggested: string | null };

type FixGroupIn = {
  field?: unknown;
  rule?: unknown;
  description?: unknown;
  values?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!unique.includes(item)) unique.push(item);
    if (unique.length >= MAX_VALUES) break;
  }
  return unique;
}

function emptyFixes(values: string[]): FixPair[] {
  return values.map((original) => ({ original, suggested: null }));
}

function parseFixes(raw: unknown, originals: string[]): FixPair[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { fixes?: unknown }).fixes)
      ? (raw as { fixes: unknown[] }).fixes
      : [];
  const byOriginal = new Map<string, string | null>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const original = (item as { original?: unknown }).original;
    const suggested = (item as { suggested?: unknown }).suggested;
    if (typeof original !== "string") continue;
    if (suggested == null) {
      byOriginal.set(original, null);
      continue;
    }
    if (typeof suggested === "string") byOriginal.set(original, suggested);
  }
  return originals.map((original) => ({
    original,
    suggested: byOriginal.has(original) ? (byOriginal.get(original) ?? null) : null,
  }));
}

export async function POST(request: Request) {
  let body: { groups?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.groups)) {
    return Response.json({ error: "groups_required" }, { status: 400 });
  }

  const groups = (body.groups as FixGroupIn[])
    .map((group) => {
      const field = typeof group.field === "string" && group.field.trim() ? group.field : null;
      if (!field) return null;
      const values = asStringArray(group.values);
      if (values.length === 0) return null;
      const known = (REQUIRED_HEADERS as readonly string[]).includes(field)
        ? (field as RequiredHeader)
        : null;
      const rule =
        typeof group.rule === "string"
          ? group.rule
          : known
            ? FIELD_RULES[known].rule
            : "parseable_date";
      const description =
        typeof group.description === "string"
          ? group.description
          : known
            ? FIELD_RULES[known].description
            : "Must be a real calendar date, for example 2024-09-15 or 9/15/2024.";
      return { field, rule, description, values };
    })
    .filter((group): group is NonNullable<typeof group> => group != null)
    .slice(0, 12);

  if (groups.length === 0) {
    return Response.json({ groups: [] });
  }

  const fallback = {
    groups: groups.map((group) => ({
      field: group.field,
      rule: group.rule,
      fixes: emptyFixes(group.values),
    })),
  };

  const apiKey = getGrokApiKey();
  if (!apiKey) return Response.json(fallback);

  const system = [
    "You suggest corrections for invalid CSV cell values.",
    "You receive only a field name, its validation rule, and the failing values for that field.",
    "You never receive full rows or other columns.",
    "Return JSON: { \"groups\": [ { \"field\": \"month\", \"fixes\": [ { \"original\": \"Nov 2024\", \"suggested\": \"2024-11\" } ] } ] }.",
    "suggested must satisfy the rule. If you are not confident, set suggested to null.",
    "Include every original value. Do not invent originals. Do not change values that already meet the rule.",
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
          { role: "user", content: JSON.stringify({ groups }) },
        ],
      }),
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) return Response.json(fallback);
    const parsed = extractJson(payload.choices?.[0]?.message?.content ?? "");
    const parsedGroups =
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { groups?: unknown }).groups)
        ? ((parsed as { groups: unknown[] }).groups)
        : Array.isArray(parsed)
          ? parsed
          : [];

    return Response.json({
      groups: groups.map((group) => {
        const match = parsedGroups.find((item) => {
          if (!item || typeof item !== "object") return false;
          return (item as { field?: unknown }).field === group.field;
        });
        const fixesRaw =
          match && typeof match === "object"
            ? (match as { fixes?: unknown }).fixes
            : parsedGroups;
        return {
          field: group.field,
          rule: group.rule,
          fixes: parseFixes(fixesRaw ?? match, group.values),
        };
      }),
    });
  } catch {
    return Response.json(fallback);
  }
}
