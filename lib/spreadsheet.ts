import * as XLSX from "xlsx";
import { parseRawCsv, type RawCsvParseResult, type RawCsvRow } from "@/lib/csv";

function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function headerLabel(value: unknown): string {
  return cellString(value).trim();
}

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

export function parseRawXlsx(
  buffer: ArrayBuffer | Uint8Array | number[],
): RawCsvParseResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(bytes, {
    type: "array",
    raw: true,
    cellDates: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      headers: [],
      rows: [],
      errors: ["Excel file has no sheets."],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[sheetName],
    {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    },
  );

  const headerIndex = matrix.findIndex((row) =>
    (row ?? []).some((cell) => headerLabel(cell).length > 0),
  );
  if (headerIndex < 0) {
    return {
      headers: [],
      rows: [],
      errors: ["File needs a header row and at least one data row."],
    };
  }

  const headerRow = matrix[headerIndex] ?? [];
  const columnIndexes: number[] = [];
  const headers: string[] = [];
  const used = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const base = headerLabel(cell);
    if (!base) return;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    headers.push(count === 0 ? base : `${base}_${count + 1}`);
    columnIndexes.push(index);
  });

  if (headers.length === 0) {
    return {
      headers: [],
      rows: [],
      errors: ["File needs a header row and at least one data row."],
    };
  }

  const rows: RawCsvRow[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const next: RawCsvRow = {};
    let empty = true;
    columnIndexes.forEach((columnIndex, headerPos) => {
      const value = cellString(row[columnIndex]);
      next[headers[headerPos]] = value;
      if (value !== "") empty = false;
    });
    if (!empty) rows.push(next);
  }

  if (rows.length === 0) {
    return {
      headers,
      rows: [],
      errors: ["File needs a header row and at least one data row."],
    };
  }

  return { headers, rows, errors: [] };
}

export async function parseRawUpload(file: File): Promise<RawCsvParseResult> {
  if (isSpreadsheetFile(file)) {
    return parseRawXlsx(await file.arrayBuffer());
  }
  return parseRawCsv(await file.text());
}
