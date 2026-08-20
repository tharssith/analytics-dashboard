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

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[\u00a0\u2000-\u200b]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

export function exactHeaderMatch(
  field: RequiredHeader,
  headers: string[],
): string {
  return matchExistingHeader(field, headers);
}

export function mappingFromExactHeaders(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  for (const field of REQUIRED_HEADERS) {
    mapping[field] = exactHeaderMatch(field, headers);
  }
  return mapping;
}

export function sanitizeColumnMapping(
  suggested: unknown,
  headers: string[],
): ColumnMapping {
  const source = unwrapMappingObject(suggested);
  const mapping = mappingFromExactHeaders(headers);
  for (const field of REQUIRED_HEADERS) {
    if (mapping[field]) continue;
    const value = source[field];
    if (typeof value !== "string") continue;
    const matched = matchExistingHeader(value, headers);
    if (matched) mapping[field] = matched;
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
