import { filterRecords, formatDateRange, uniqueMonths } from "@/lib/data";
import {
  KIND_LABELS,
  computeGenericAnalytics,
  filterGenericRows,
} from "@/lib/dataset";
import { getStoredDataset } from "@/lib/dataset-store";
import { getGrokApiKey } from "@/lib/grok";
import { getOrSeedHrRecords } from "@/lib/hr-store";
import { buildGenericQaPrompt, buildQaPrompt } from "@/lib/qa-prompt";
import { buildQaDashboardValues } from "@/lib/report";
import type { DepartmentFilter, FilterState } from "@/lib/types";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4.6";

function isConfigured(): boolean {
  return Boolean(getGrokApiKey());
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
    startMonth?: unknown;
    endMonth?: unknown;
    department?: unknown;
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

  const stored = await getStoredDataset();
  if (stored.dataset && stored.dataset.kind !== "hr") {
    const data = stored.dataset;
    const filtered = filterGenericRows(
      data.rows,
      data,
      typeof body.startMonth === "string" ? body.startMonth : "",
      typeof body.endMonth === "string" ? body.endMonth : "",
      typeof body.department === "string" ? body.department : "All",
    );
    const analytics = computeGenericAnalytics(filtered, data);
    const summary = analytics.tiles
      .map((tile) => `${tile.label}: ${tile.display}`)
      .join("; ");
    const system = buildGenericQaPrompt({
      kindLabel: KIND_LABELS[data.kind],
      filename: data.filename,
      dateRange: `${body.startMonth ?? ""} to ${body.endMonth ?? ""}`,
      category: typeof body.department === "string" ? body.department : "All",
      summary,
      filteredData: filtered,
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
        return Response.json({ error: grokErrorMessage(payload) }, { status: 502 });
      }
      return Response.json({
        answer: payload.choices?.[0]?.message?.content?.trim() ?? "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "grok_request_failed";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const loaded = await getOrSeedHrRecords();
  if (loaded.error === "Sign in required.") {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
  if (loaded.error && loaded.records.length === 0) {
    return Response.json({ error: loaded.error }, { status: 500 });
  }

  const months = uniqueMonths(loaded.records);
  const startMonth =
    typeof body.startMonth === "string" && months.includes(body.startMonth)
      ? body.startMonth
      : months[0] ?? "";
  const endMonth =
    typeof body.endMonth === "string" && months.includes(body.endMonth)
      ? body.endMonth
      : months[months.length - 1] ?? "";
  const department =
    typeof body.department === "string" ? body.department : "All";

  const filters: FilterState = {
    startMonth,
    endMonth,
    department: department as DepartmentFilter,
  };
  const records = filterRecords(loaded.records, filters);
  const dateRange = formatDateRange(startMonth, endMonth);
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
