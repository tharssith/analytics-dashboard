import Papa from "papaparse";
import type { HrRecord } from "@/lib/types";
import { mappedRowsFromRaw, rowsToRecords } from "@/lib/upload-validate";

export const REQUIRED_HEADERS = [
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
] as const;

export type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

export type ColumnMapping = Record<RequiredHeader, string>;

export type RawCsvRow = Record<string, string>;

export type RawCsvParseResult = {
  headers: string[];
  rows: RawCsvRow[];
  errors: string[];
};

export type CsvParseResult = {
  records: HrRecord[];
  errors: string[];
  warnings: string[];
};

const NOT_FOUND = "not found";

const FIELD_ALIASES: Record<RequiredHeader, string[]> = {
  month: [
    "month",
    "period",
    "year month",
    "month year",
    "calendar month",
    "snapshot month",
    "month ending",
    "as of",
    "as of month",
    "yyyymm",
    "yyyy mm",
  ],
  department: [
    "department",
    "dept",
    "team",
    "division",
    "business unit",
    "org unit",
    "cost center",
    "function",
    "department name",
    "dept name",
  ],
  headcount: [
    "headcount",
    "head count",
    "emp count",
    "employee count",
    "employees",
    "ending hc",
    "ending headcount",
    "fte",
    "staff",
    "hc",
  ],
  target_headcount: [
    "target headcount",
    "target hc",
    "target head count",
    "plan hc",
    "planned hc",
    "budgeted hc",
    "hc target",
    "headcount target",
  ],
  new_hires: [
    "new hires",
    "new hire",
    "hires",
    "hired",
    "joiners",
    "starts",
    "hire count",
  ],
  attrition_count: [
    "attrition count",
    "attrition",
    "exits",
    "separations",
    "leavers",
    "turnover count",
    "terms",
    "terminations",
  ],
  time_to_hire_days: [
    "time to hire days",
    "time to hire",
    "days to hire",
    "time to fill",
    "tth",
    "ttf",
    "hire days",
  ],
  referral_pct: [
    "referral pct",
    "referral %",
    "referral",
    "referrals",
    "referral percent",
    "source referral",
  ],
  job_board_pct: [
    "job board pct",
    "job board %",
    "job board",
    "jobboard",
    "boards",
    "job boards",
    "source job board",
  ],
  agency_pct: [
    "agency pct",
    "agency %",
    "agency",
    "agencies",
    "recruiter pct",
    "agency percent",
    "source agency",
  ],
};

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[\u00a0\u2000-\u200b]/g, " ")
    .replace(/%/g, " pct ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function headerTokens(value: string): string[] {
  return normalizeHeaderKey(value).split(" ").filter(Boolean);
}

function aliasScore(field: RequiredHeader, header: string): number {
  const normalized = normalizeHeaderKey(header);
  if (!normalized) return 0;
  const tokens = headerTokens(header);
  const names = [field.replace(/_/g, " "), ...FIELD_ALIASES[field]];
  let best = 0;
  for (const name of names) {
    const alias = normalizeHeaderKey(name);
    const aliasTokens = headerTokens(name);
    if (!alias || aliasTokens.length === 0) continue;
    if (normalized === alias) {
      best = Math.max(best, alias === normalizeHeaderKey(field) ? 100 : 96);
      continue;
    }
    if (aliasTokens.every((token) => tokens.includes(token))) {
      const extra = tokens.length - aliasTokens.length;
      const score =
        aliasTokens.length === 1 && alias.length <= 3
          ? extra === 0
            ? 88
            : 0
          : extra === 0
            ? 90
            : alias.length >= 8
              ? 78
              : 70;
      best = Math.max(best, score);
    }
  }
  return best;
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  const used = new Set<string>();
  const headerSet = new Set(headers);
  const candidates: Array<{
    field: RequiredHeader;
    header: string;
    score: number;
  }> = [];
  for (const field of REQUIRED_HEADERS) {
    for (const header of headers) {
      const score = aliasScore(field, header);
      if (score <= 0) continue;
      candidates.push({ field, header, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.field.localeCompare(b.field));
  for (const candidate of candidates) {
    if (mapping[candidate.field] || used.has(candidate.header)) continue;
    if (!headerSet.has(candidate.header)) continue;
    mapping[candidate.field] = candidate.header;
    used.add(candidate.header);
  }
  return mapping;
}

export function matchExistingHeader(
  candidate: string,
  headers: string[],
): string {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.toLowerCase() === NOT_FOUND) return "";
  const exact = headers.find((header) => header === trimmed);
  if (exact) return exact;
  const needle = normalizeHeaderKey(trimmed);
  return (
    headers.find((header) => normalizeHeaderKey(header) === needle) ?? ""
  );
}

export function unwrapMappingObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  if (REQUIRED_HEADERS.some((field) => typeof record[field] === "string")) {
    return record;
  }
  for (const nested of Object.values(record)) {
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const inner = nested as Record<string, unknown>;
    if (REQUIRED_HEADERS.some((field) => typeof inner[field] === "string")) {
      return inner;
    }
  }
  return record;
}

function asCellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function emptyMapping(): ColumnMapping {
  return {
    month: "",
    department: "",
    headcount: "",
    target_headcount: "",
    new_hires: "",
    attrition_count: "",
    time_to_hire_days: "",
    referral_pct: "",
    job_board_pct: "",
    agency_pct: "",
  };
}

export function identityHrMapping(): ColumnMapping {
  const mapping = emptyMapping();
  for (const field of REQUIRED_HEADERS) mapping[field] = field;
  return mapping;
}

export function recordsToRawRows(records: HrRecord[]): RawCsvRow[] {
  return records.map((record) => ({
    month: record.month,
    department: record.department,
    headcount: String(record.headcount),
    target_headcount: String(record.target_headcount),
    new_hires: String(record.new_hires),
    attrition_count: String(record.attrition_count),
    time_to_hire_days:
      record.time_to_hire_days == null ? "" : String(record.time_to_hire_days),
    referral_pct: String(record.source_of_hire.referral_pct),
    job_board_pct: String(record.source_of_hire.job_board_pct),
    agency_pct: String(record.source_of_hire.agency_pct),
  }));
}

export function exactHeaderMatch(
  field: RequiredHeader,
  headers: string[],
): string {
  return matchExistingHeader(field, headers);
}

export function mappingFromExactHeaders(headers: string[]): ColumnMapping {
  return suggestColumnMapping(headers);
}

export function sanitizeColumnMapping(
  suggested: unknown,
  headers: string[],
): ColumnMapping {
  const source = unwrapMappingObject(suggested);
  const mapping = emptyMapping();
  for (const field of REQUIRED_HEADERS) {
    const value = source[field];
    if (typeof value !== "string") continue;
    const matched = matchExistingHeader(value, headers);
    if (matched) mapping[field] = matched;
  }
  const local = suggestColumnMapping(headers);
  for (const field of REQUIRED_HEADERS) {
    if (!mapping[field]) mapping[field] = local[field];
  }
  return mapping;
}

export function mappingFillCount(mapping: ColumnMapping): number {
  return REQUIRED_HEADERS.filter((field) => mapping[field]).length;
}

export function isMappingComplete(
  mapping: ColumnMapping,
  headers: string[],
): boolean {
  const headerSet = new Set(headers);
  return REQUIRED_HEADERS.every((field) => headerSet.has(mapping[field]));
}

export function parseRawCsv(text: string): RawCsvParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader(header) {
      return header
        .replace(/^\uFEFF/, "")
        .replace(/[\u00a0\u2000-\u200b]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    },
  });

  const headers = (parsed.meta.fields ?? [])
    .map((header) => header.replace(/^\uFEFF/, "").trim())
    .filter((header) => header.length > 0);

  if (headers.length === 0) {
    return {
      headers: [],
      rows: [],
      errors: ["CSV needs a header row and at least one data row."],
    };
  }

  const rows: RawCsvRow[] = parsed.data.map((row) => {
    const next: RawCsvRow = {};
    for (const header of headers) {
      next[header] = asCellString(row[header]);
    }
    return next;
  });

  if (rows.length === 0) {
    return {
      headers,
      rows: [],
      errors: ["CSV needs a header row and at least one data row."],
    };
  }

  const parseErrors = parsed.errors
    .filter((error) => error.type === "Quotes" || error.type === "FieldMismatch")
    .slice(0, 8)
    .map((error) => error.message);

  return { headers, rows, errors: parseErrors };
}

export function applyColumnMapping(
  rows: RawCsvRow[],
  mapping: ColumnMapping,
): RawCsvRow[] {
  return rows.map((row) => {
    const next: RawCsvRow = {};
    for (const field of REQUIRED_HEADERS) {
      const source = mapping[field];
      next[field] = Object.hasOwn(row, source) ? row[source] : "";
    }
    return next;
  });
}

export function writeMappedCellsToRaw(
  rows: RawCsvRow[],
  mapping: ColumnMapping,
  mapped: Array<{ id: string; cells: Record<RequiredHeader, string> }>,
): RawCsvRow[] {
  const byId = new Map(mapped.map((row) => [row.id, row]));
  return rows.map((row, index) => {
    const source = byId.get(`r${index}`);
    if (!source) return row;
    const next = { ...row };
    for (const field of REQUIRED_HEADERS) {
      const header = mapping[field];
      if (header) next[header] = source.cells[field] ?? "";
    }
    return next;
  });
}

export function parseHrCsv(text: string): CsvParseResult {
  const raw = parseRawCsv(text);
  if (raw.errors.length > 0 && raw.rows.length === 0) {
    return { records: [], errors: raw.errors, warnings: [] };
  }

  const mapping = mappingFromExactHeaders(raw.headers);
  const missing = REQUIRED_HEADERS.filter((field) => !mapping[field]);
  if (missing.length > 0) {
    return {
      records: [],
      errors: [`CSV is missing columns: ${missing.join(", ")}`],
      warnings: [],
    };
  }

  return validateMappedRows(applyColumnMapping(raw.rows, mapping));
}

export function validateMappedRows(rows: RawCsvRow[]): CsvParseResult {
  return { ...rowsToRecords(mappedRowsFromRaw(rows)), warnings: [] };
}
