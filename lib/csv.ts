import type { HrRecord } from "@/lib/types";

const REQUIRED_HEADERS = [
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

export type CsvParseResult = {
  records: HrRecord[];
  errors: string[];
  warnings: string[];
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseNumber(value: string, field: string, row: number): number | string {
  if (value === "") return `${field} on row ${row} is empty`;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${field} on row ${row} is not a number`;
  if (parsed < 0) return `${field} on row ${row} cannot be negative`;
  return parsed;
}

export function parseHrCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { records: [], errors: ["CSV needs a header row and at least one data row."], warnings: [] };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const index = new Map(headers.map((header, i) => [header, i]));
  const missing = REQUIRED_HEADERS.filter((header) => !index.has(header));
  if (missing.length > 0) {
    return {
      records: [],
      errors: [`CSV is missing columns: ${missing.join(", ")}`],
      warnings: [],
    };
  }

  const records: HrRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]);
    const read = (key: (typeof REQUIRED_HEADERS)[number]) =>
      cells[index.get(key) ?? -1] ?? "";

    const month = read("month");
    const department = read("department");
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

    const headcount = parseNumber(read("headcount"), "headcount", rowNumber);
    const target = parseNumber(read("target_headcount"), "target_headcount", rowNumber);
    const hires = parseNumber(read("new_hires"), "new_hires", rowNumber);
    const attrition = parseNumber(read("attrition_count"), "attrition_count", rowNumber);
    const referral = parseNumber(read("referral_pct"), "referral_pct", rowNumber);
    const jobBoard = parseNumber(read("job_board_pct"), "job_board_pct", rowNumber);
    const agency = parseNumber(read("agency_pct"), "agency_pct", rowNumber);
    const tthRaw = read("time_to_hire_days");
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
