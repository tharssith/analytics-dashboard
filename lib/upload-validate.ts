import {
  REQUIRED_HEADERS,
  type RawCsvRow,
  type RequiredHeader,
} from "@/lib/csv";
import { isParseableTimeValue } from "@/lib/dataset";
import type { HrRecord } from "@/lib/types";

export type MappedRow = {
  id: string;
  cells: Record<RequiredHeader, string>;
};

export type CellIssue = {
  rowId: string;
  field: string;
  value: string;
  rule: string;
  message: string;
};

export type IssueGroup = {
  field: string;
  rule: string;
  description: string;
  values: string[];
};

const MONTH_RE = /^\d{4}-\d{2}$/;
const NUMERIC_FIELDS = [
  "headcount",
  "target_headcount",
  "new_hires",
  "attrition_count",
  "referral_pct",
  "job_board_pct",
  "agency_pct",
] as const;
const MIX_FIELDS = ["referral_pct", "job_board_pct", "agency_pct"] as const;

export const FIELD_RULES: Record<
  RequiredHeader,
  { rule: string; description: string }
> = {
  month: {
    rule: "month_yyyy_mm",
    description: "Must be a calendar month in YYYY-MM form, for example 2024-11.",
  },
  department: {
    rule: "required_text",
    description: "Must be a non-empty department name.",
  },
  headcount: {
    rule: "numeric_nonnegative",
    description: "Must be a number greater than or equal to 0.",
  },
  target_headcount: {
    rule: "numeric_nonnegative",
    description: "Must be a number greater than or equal to 0.",
  },
  new_hires: {
    rule: "numeric_nonnegative",
    description: "Must be a number greater than or equal to 0.",
  },
  attrition_count: {
    rule: "numeric_nonnegative",
    description: "Must be a number greater than or equal to 0.",
  },
  time_to_hire_days: {
    rule: "optional_numeric_nonnegative",
    description:
      "May be empty, or a number greater than or equal to 0 (days to hire).",
  },
  referral_pct: {
    rule: "numeric_nonnegative",
    description:
      "Must be a number >= 0. referral_pct + job_board_pct + agency_pct must equal 100.",
  },
  job_board_pct: {
    rule: "numeric_nonnegative",
    description:
      "Must be a number >= 0. referral_pct + job_board_pct + agency_pct must equal 100.",
  },
  agency_pct: {
    rule: "numeric_nonnegative",
    description:
      "Must be a number >= 0. referral_pct + job_board_pct + agency_pct must equal 100.",
  },
};

export function mappedRowsFromRaw(rows: RawCsvRow[]): MappedRow[] {
  return rows.map((row, index) => ({
    id: `r${index}`,
    cells: Object.fromEntries(
      REQUIRED_HEADERS.map((field) => [field, row[field] ?? ""]),
    ) as Record<RequiredHeader, string>,
  }));
}

function parseNonNegative(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function checkField(
  field: RequiredHeader,
  value: string,
): { rule: string; message: string } | null {
  if (field === "month") {
    if (!MONTH_RE.test(value)) {
      return { rule: FIELD_RULES.month.rule, message: "must be YYYY-MM" };
    }
    return null;
  }
  if (field === "department") {
    if (!value.trim()) {
      return { rule: FIELD_RULES.department.rule, message: "is empty" };
    }
    return null;
  }
  if (field === "time_to_hire_days") {
    if (value === "") return null;
    if (parseNonNegative(value) == null) {
      return {
        rule: FIELD_RULES.time_to_hire_days.rule,
        message: "must be empty or a number ≥ 0",
      };
    }
    return null;
  }
  if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
    if (parseNonNegative(value) == null) {
      return {
        rule: FIELD_RULES[field].rule,
        message: value === "" ? "is empty" : "is not a number ≥ 0",
      };
    }
  }
  return null;
}

export function checkTimeValue(
  value: string,
): { rule: string; message: string } | null {
  if (value.trim() === "") return null;
  if (!isParseableTimeValue(value)) {
    return { rule: "parseable_date", message: "is not a real date" };
  }
  return null;
}

export function inspectGenericRows(
  rows: RawCsvRow[],
  timeField: string | null,
): CellIssue[] {
  if (!timeField) return [];
  const issues: CellIssue[] = [];
  rows.forEach((row, index) => {
    const value = row[timeField] ?? "";
    const failed = checkTimeValue(value);
    if (!failed) return;
    issues.push({
      rowId: `r${index}`,
      field: timeField,
      value,
      rule: failed.rule,
      message: failed.message,
    });
  });
  return issues;
}

export function inspectRows(rows: MappedRow[]): CellIssue[] {
  const issues: CellIssue[] = [];

  for (const row of rows) {
    for (const field of REQUIRED_HEADERS) {
      const value = row.cells[field] ?? "";
      const failed = checkField(field, value);
      if (failed) {
        issues.push({
          rowId: row.id,
          field,
          value,
          rule: failed.rule,
          message: failed.message,
        });
      }
    }

    const mixValues = MIX_FIELDS.map((field) =>
      parseNonNegative(row.cells[field] ?? ""),
    );
    if (mixValues.every((value) => value != null)) {
      const mix = (mixValues as number[]).reduce((sum, value) => sum + value, 0);
      if (Math.abs(mix - 100) > 0.05) {
        for (const field of MIX_FIELDS) {
          issues.push({
            rowId: row.id,
            field,
            value: row.cells[field] ?? "",
            rule: "percentage_sum_100",
            message: `source mix is ${mix}, not 100`,
          });
        }
      }
    }
  }

  const seen = new Map<string, string>();
  for (const row of rows) {
    const monthIssue = issues.some(
      (issue) => issue.rowId === row.id && issue.field === "month",
    );
    const deptIssue = issues.some(
      (issue) => issue.rowId === row.id && issue.field === "department",
    );
    if (monthIssue || deptIssue) continue;
    const key = `${row.cells.month}::${row.cells.department}`;
    const first = seen.get(key);
    if (!first) {
      seen.set(key, row.id);
      continue;
    }
    issues.push({
      rowId: row.id,
      field: "month",
      value: row.cells.month,
      rule: "unique_month_department",
      message: `duplicate ${key}`,
    });
    issues.push({
      rowId: row.id,
      field: "department",
      value: row.cells.department,
      rule: "unique_month_department",
      message: `duplicate ${key}`,
    });
  }

  return issues;
}

export function groupIssues(issues: CellIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = `${issue.field}::${issue.rule}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.values.includes(issue.value)) existing.values.push(issue.value);
      continue;
    }
    const fieldRule = FIELD_RULES[issue.field as RequiredHeader];
    groups.set(key, {
      field: issue.field,
      rule: issue.rule,
      description:
        issue.rule === "percentage_sum_100"
          ? "referral_pct + job_board_pct + agency_pct must equal 100."
          : issue.rule === "unique_month_department"
            ? "Each month + department pair must be unique."
            : issue.rule === "parseable_date"
              ? "Must be a real calendar date, for example 2024-09-15 or 9/15/2024."
            : fieldRule?.description ?? issue.message,
      values: [issue.value],
    });
  }
  return [...groups.values()];
}

export function issueForCell(
  issues: CellIssue[],
  rowId: string,
  field: string,
): CellIssue | undefined {
  return issues.find((issue) => issue.rowId === rowId && issue.field === field);
}

export function failingRowIds(issues: CellIssue[]): Set<string> {
  return new Set(issues.map((issue) => issue.rowId));
}

export function rowToRecord(row: MappedRow): HrRecord | string {
  const rowIssues = inspectRows([row]);
  if (rowIssues.length > 0) {
    return `${rowIssues[0].field} ${rowIssues[0].message}`;
  }
  const num = (field: RequiredHeader) => Number(row.cells[field]);
  const tth = row.cells.time_to_hire_days;
  return {
    month: row.cells.month,
    department: row.cells.department,
    headcount: num("headcount"),
    target_headcount: num("target_headcount"),
    new_hires: num("new_hires"),
    attrition_count: num("attrition_count"),
    time_to_hire_days: tth === "" ? null : Number(tth),
    source_of_hire: {
      referral_pct: num("referral_pct"),
      job_board_pct: num("job_board_pct"),
      agency_pct: num("agency_pct"),
    },
  };
}

export function rowsToRecords(rows: MappedRow[]): {
  records: HrRecord[];
  errors: string[];
} {
  const issues = inspectRows(rows);
  if (issues.length > 0) {
    return {
      records: [],
      errors: issues.slice(0, 12).map((issue) => {
        const rowNumber = Number(issue.rowId.replace("r", "")) + 2;
        return `${issue.field} on row ${rowNumber} ${issue.message}`;
      }),
    };
  }
  return {
    records: rows.map((row) => rowToRecord(row) as HrRecord),
    errors: [],
  };
}

export function applyRawFieldFixes(
  rows: RawCsvRow[],
  field: string,
  fixes: Array<{ original: string; suggested: string }>,
): RawCsvRow[] {
  const lookup = new Map(fixes.map((fix) => [fix.original, fix.suggested]));
  return rows.map((row) => {
    const current = row[field];
    const next = lookup.get(current);
    if (next == null) return row;
    return { ...row, [field]: next };
  });
}

export function applyValueFixes(
  rows: MappedRow[],
  field: RequiredHeader,
  fixes: Array<{ original: string; suggested: string }>,
): MappedRow[] {
  const lookup = new Map(fixes.map((fix) => [fix.original, fix.suggested]));
  return rows.map((row) => {
    const current = row.cells[field];
    const next = lookup.get(current);
    if (next == null) return row;
    return { ...row, cells: { ...row.cells, [field]: next } };
  });
}
