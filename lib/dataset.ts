import type { RawCsvRow } from "@/lib/csv";
import type { KpiTileModel, RagStatus } from "@/lib/types";

export const DATASET_KINDS = [
  "hr",
  "sales",
  "finance",
  "operations",
  "generic",
] as const;

export type DatasetKind = (typeof DATASET_KINDS)[number];

export const KIND_LABELS: Record<DatasetKind, string> = {
  hr: "HR / Workforce",
  sales: "Sales",
  finance: "Finance",
  operations: "Operations",
  generic: "General data",
};

export type DatasetProfile = {
  filename: string;
  kind: DatasetKind;
  typeFromName: DatasetKind;
  typeFromHeaders: DatasetKind;
  nameHeaderMatch: boolean;
  reason: string;
  timeField: string | null;
  categoryField: string | null;
  metricFields: string[];
  headers: string[];
};

export type StoredDataset = DatasetProfile & {
  rows: RawCsvRow[];
};

export function isDatasetKind(value: unknown): value is DatasetKind {
  return typeof value === "string" && (DATASET_KINDS as readonly string[]).includes(value);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function headerBlob(headers: string[]): string {
  return headers.map(normalize).join(" | ");
}

export function kindFromFilename(filename: string): DatasetKind {
  const name = normalize(filename);
  if (/(hr|workforce|headcount|people|attrition|recruit|employee)/.test(name)) {
    return "hr";
  }
  if (/(sales|revenue|order|superstore|invoice|customer|styles)/.test(name)) {
    return "sales";
  }
  if (/(finance|budget|pnl|ledger|expense|account|p l)/.test(name)) {
    return "finance";
  }
  if (/(ops|operation|inventory|logistic|supply)/.test(name)) {
    return "operations";
  }
  return "generic";
}

export function kindFromHeaders(headers: string[]): DatasetKind {
  const blob = headerBlob(headers);
  const score = (needles: string[]) =>
    needles.reduce((sum, needle) => (blob.includes(needle) ? sum + 1 : sum), 0);
  const hr = score(["headcount", "attrition", "new hires", "department", "hire", "referral"]);
  const sales = score(["sales", "profit", "quantity", "order", "discount", "segment", "customer"]);
  const finance = score(["amount", "debit", "credit", "account", "expense", "revenue", "balance"]);
  const operations = score(["inventory", "sku", "warehouse", "units", "lead time", "stock"]);
  const ranked = [
    { kind: "hr" as const, score: hr },
    { kind: "sales" as const, score: sales },
    { kind: "finance" as const, score: finance },
    { kind: "operations" as const, score: operations },
  ].sort((a, b) => b.score - a.score);
  if ((ranked[0]?.score ?? 0) >= 2) return ranked[0].kind;
  if ((ranked[0]?.score ?? 0) === 1 && (ranked[1]?.score ?? 0) === 0) {
    return ranked[0].kind;
  }
  return "generic";
}

function looksLikeTime(header: string): boolean {
  return /(date|month|period|year|week|day|time)/.test(normalize(header));
}

function looksLikeCategory(header: string): boolean {
  return /(region|segment|categor|department|dept|city|state|product|team|channel|type)/.test(
    normalize(header),
  );
}

export function parseNumber(value: string): number | null {
  const trimmed = value.replace(/[%$,]/g, "").trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isNumericColumn(rows: RawCsvRow[], header: string): boolean {
  let numeric = 0;
  let seen = 0;
  for (const row of rows.slice(0, 40)) {
    const value = row[header] ?? "";
    if (value === "") continue;
    seen += 1;
    if (parseNumber(value) != null) numeric += 1;
  }
  return seen >= 3 && numeric / seen >= 0.7;
}

export function inferRoles(
  headers: string[],
  rows: RawCsvRow[],
): Pick<DatasetProfile, "timeField" | "categoryField" | "metricFields"> {
  const timeField = headers.find((header) => looksLikeTime(header)) ?? null;
  const categoryField =
    headers.find((header) => looksLikeCategory(header) && header !== timeField) ??
    headers.find((header) => header !== timeField && !isNumericColumn(rows, header)) ??
    null;
  const metricFields = headers.filter(
    (header) => header !== timeField && header !== categoryField && isNumericColumn(rows, header),
  );
  return { timeField, categoryField, metricFields };
}

function monthKeyFromUtc(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1800 || year > 2200) return null;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function excelSerialToMonthKey(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  return monthKeyFromUtc(
    new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000),
  );
}

export function toMonthKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return monthKeyFromUtc(new Date(`${trimmed}-01T00:00:00Z`));
  }
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return monthKeyFromUtc(new Date(`${iso[1]}T00:00:00Z`));
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (trimmed.length === 4 && numeric >= 1900 && numeric <= 2100) {
      return `${trimmed}-01`;
    }
    return excelSerialToMonthKey(numeric);
  }
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return monthKeyFromUtc(new Date(parsed));
  return null;
}

export function buildLocalProfile(
  filename: string,
  headers: string[],
  rows: RawCsvRow[],
): DatasetProfile {
  const typeFromName = kindFromFilename(filename);
  const typeFromHeaders = kindFromHeaders(headers);
  const kind =
    typeFromName === typeFromHeaders
      ? typeFromName
      : typeFromHeaders !== "generic"
        ? typeFromHeaders
        : typeFromName;
  const roles = inferRoles(headers, rows);
  const nameHeaderMatch = typeFromName === typeFromHeaders || typeFromHeaders === "generic" || typeFromName === "generic";
  const reason = nameHeaderMatch
    ? `Filename points to ${KIND_LABELS[typeFromName]}; columns point to ${KIND_LABELS[typeFromHeaders]}.`
    : `Filename looks like ${KIND_LABELS[typeFromName]}, but columns look like ${KIND_LABELS[typeFromHeaders]}. Check the file type before continuing.`;
  return {
    filename,
    kind,
    typeFromName,
    typeFromHeaders,
    nameHeaderMatch,
    reason,
    headers,
    ...roles,
  };
}

export function withKind(profile: DatasetProfile, kind: DatasetKind): DatasetProfile {
  return {
    ...profile,
    kind,
    nameHeaderMatch:
      profile.typeFromName === kind ||
      profile.typeFromHeaders === kind ||
      profile.typeFromName === "generic" ||
      profile.typeFromHeaders === "generic",
  };
}

export type GenericPoint = { label: string; value: number };

export type GenericAnalytics = {
  title: string;
  subtitle: string;
  tiles: KpiTileModel[];
  series: GenericPoint[];
  breakdown: GenericPoint[];
  seriesLabel: string;
  breakdownLabel: string;
  rowCount: number;
};

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function filterGenericRows(
  rows: RawCsvRow[],
  profile: DatasetProfile,
  startMonth: string,
  endMonth: string,
  category: string,
): RawCsvRow[] {
  return rows.filter((row) => {
    if (profile.timeField && startMonth && endMonth) {
      const month = toMonthKey(row[profile.timeField] ?? "");
      if (month && (month < startMonth || month > endMonth)) return false;
    }
    if (profile.categoryField && category !== "All") {
      if ((row[profile.categoryField] ?? "") !== category) return false;
    }
    return true;
  });
}

export function uniqueGenericMonths(rows: RawCsvRow[], timeField: string | null): string[] {
  if (!timeField) return [];
  return [...new Set(rows.map((row) => toMonthKey(row[timeField] ?? "")).filter(Boolean))].sort() as string[];
}

export function uniqueGenericCategories(
  rows: RawCsvRow[],
  categoryField: string | null,
): string[] {
  if (!categoryField) return [];
  return [...new Set(rows.map((row) => row[categoryField] ?? "").filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function computeGenericAnalytics(
  rows: RawCsvRow[],
  profile: DatasetProfile,
): GenericAnalytics {
  const metrics = profile.metricFields.slice(0, 4);
  const sums = metrics.map(() => 0);
  const counts = metrics.map(() => 0);
  const monthSums = metrics.map(() => new Map<string, number>());
  const categoryTotals = new Map<string, number>();
  const primary = metrics[0] ?? null;

  for (const row of rows) {
    const month = profile.timeField ? toMonthKey(row[profile.timeField] ?? "") : null;
    const values = metrics.map((field) => parseNumber(row[field] ?? ""));
    values.forEach((value, index) => {
      if (value == null) return;
      sums[index] += value;
      counts[index] += 1;
      if (month) {
        const bucket = monthSums[index];
        bucket.set(month, (bucket.get(month) ?? 0) + value);
      }
    });
    if (primary && profile.categoryField) {
      const key = row[profile.categoryField] || "Unknown";
      categoryTotals.set(
        key,
        (categoryTotals.get(key) ?? 0) + (values[0] ?? 0),
      );
    }
  }

  const tiles: KpiTileModel[] = metrics.map((field, index) => {
    const total = sums[index];
    const count = counts[index];
    const sparkline = [...monthSums[index].entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([month, value]) => ({ month, value }));
    return {
      id: field,
      label: field,
      display: formatNumber(total),
      context: `${count} values · avg ${formatNumber(count ? total / count : 0)}`,
      status: index === 0 ? "green" : "neutral",
      expandable: false,
      sparkline,
    };
  });

  if (tiles.length === 0) {
    tiles.push({
      id: "rows",
      label: "Rows",
      display: String(rows.length),
      context: `${profile.headers.length} columns from ${profile.filename}`,
      status: "neutral",
      expandable: false,
      sparkline: [],
    });
  }

  const series: GenericPoint[] = primary
    ? [...monthSums[0].entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }))
    : [];

  const breakdown: GenericPoint[] = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  return {
    title: `${KIND_LABELS[profile.kind]} analytics`,
    subtitle: profile.filename,
    tiles,
    series,
    breakdown,
    seriesLabel: primary && profile.timeField ? `${primary} over time` : "Trend",
    breakdownLabel:
      primary && profile.categoryField ? `${primary} by ${profile.categoryField}` : "Breakdown",
    rowCount: rows.length,
  };
}

export const DEFAULT_HR_PROFILE: DatasetProfile = {
  filename: "Northstar HR seed",
  kind: "hr",
  typeFromName: "hr",
  typeFromHeaders: "hr",
  nameHeaderMatch: true,
  reason: "Default workforce dataset.",
  timeField: "month",
  categoryField: "department",
  metricFields: ["headcount", "new_hires", "attrition_count"],
  headers: [
    "month",
    "department",
    "headcount",
    "target_headcount",
    "new_hires",
    "attrition_count",
    "time_to_hire_days",
    "referral_pct",
    "job_board_pct",
    "agency_pct",
  ],
};
