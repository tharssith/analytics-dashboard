import Papa from "papaparse";
import type { HrRecord } from "@/lib/types";

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
  return headers.find((header) => header.toLowerCase() === field) ?? "";
}

export function mappingFromExactHeaders(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  for (const field of REQUIRED_HEADERS) {
    mapping[field] = exactHeaderMatch(field, headers);
  }
  return mapping;
}

export function sanitizeColumnMapping(
  suggested: Record<string, unknown>,
  headers: string[],
): ColumnMapping {
  const headerSet = new Set(headers);
  const mapping = mappingFromExactHeaders(headers);
  for (const field of REQUIRED_HEADERS) {
    if (mapping[field]) continue;
    const value = suggested[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === NOT_FOUND) continue;
    if (headerSet.has(trimmed)) mapping[field] = trimmed;
  }
  return mapping;
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
      return header.replace(/^\uFEFF/, "").trim();
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

function parseNumber(value: string, field: string, row: number): number | string {
  if (value === "") return `${field} on row ${row} is empty`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${field} on row ${row} is not a number`;
  if (parsed < 0) return `${field} on row ${row} cannot be negative`;
  return parsed;
}

export function validateMappedRows(rows: RawCsvRow[]): CsvParseResult {
  const records: HrRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2;
    const row = rows[i];
    const month = row.month ?? "";
    const department = row.department ?? "";

    if (!/^\d{4}-\d{2}$/.test(month)) {
      errors.push(`month on row ${rowNumber} must be YYYY-MM`);
      continue;
    }
    if (!department) {
      errors.push(`department on row ${rowNumber} is empty`);
      continue;
    }

    const key = `${month}::${department}`;
    if (seen.has(key)) {
      errors.push(`Duplicate ${month} / ${department} on row ${rowNumber}`);
      continue;
    }
    seen.add(key);

    const headcount = parseNumber(row.headcount ?? "", "headcount", rowNumber);
    const target = parseNumber(
      row.target_headcount ?? "",
      "target_headcount",
      rowNumber,
    );
    const hires = parseNumber(row.new_hires ?? "", "new_hires", rowNumber);
    const attrition = parseNumber(
      row.attrition_count ?? "",
      "attrition_count",
      rowNumber,
    );
    const referral = parseNumber(row.referral_pct ?? "", "referral_pct", rowNumber);
    const jobBoard = parseNumber(
      row.job_board_pct ?? "",
      "job_board_pct",
      rowNumber,
    );
    const agency = parseNumber(row.agency_pct ?? "", "agency_pct", rowNumber);
    const tthRaw = row.time_to_hire_days ?? "";
    let timeToHire: number | null = null;
    if (tthRaw !== "") {
      const parsed = parseNumber(tthRaw, "time_to_hire_days", rowNumber);
      if (typeof parsed === "string") {
        errors.push(parsed);
        continue;
      }
      timeToHire = parsed;
    }

    const numeric = [headcount, target, hires, attrition, referral, jobBoard, agency];
    const firstError = numeric.find((value) => typeof value === "string");
    if (typeof firstError === "string") {
      errors.push(firstError);
      continue;
    }

    const mix =
      (referral as number) + (jobBoard as number) + (agency as number);
    if (Math.abs(mix - 100) > 0.05) {
      warnings.push(
        `Row ${rowNumber}: source mix is ${mix}, not 100 (upload still allowed).`,
      );
    }

    records.push({
      month,
      department,
      headcount: headcount as number,
      target_headcount: target as number,
      new_hires: hires as number,
      attrition_count: attrition as number,
      time_to_hire_days: timeToHire,
      source_of_hire: {
        referral_pct: referral as number,
        job_board_pct: jobBoard as number,
        agency_pct: agency as number,
      },
    });
  }

  return { records, errors, warnings };
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
