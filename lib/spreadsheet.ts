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
  if (Array.isArray(value)) return value.map(cellString).join("");
  if (typeof value === "object") {
    const record = value as { w?: unknown; v?: unknown; t?: unknown };
    if (record.w != null && record.w !== "") return cellString(record.w);
    if (record.v != null) return cellString(record.v);
  }
  return "";
}

function headerLabel(value: unknown): string {
  return cellString(value)
    .replace(/[\u00a0\u2000-\u200b]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumericLike(text: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(text);
}

function scoreHeaderRow(row: Array<{ header: string; data: string }>): number {
  const labels = (row ?? []).map((cell) => cell.header).filter((label) => label.length > 0);
  if (labels.length < 2) return 0;
  const textLabels = labels.filter((label) => !isNumericLike(label)).length;
  if (textLabels < 2) return 0;
  return textLabels * 10 + labels.length;
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

function fromExcelCell(cell: XLSX.CellObject | undefined): {
  header: string;
  data: string;
} {
  if (!cell) return { header: "", data: "" };
  const header = headerLabel(cell.w ?? cell.v);
  const data =
    typeof cell.v === "number" || typeof cell.v === "boolean"
      ? cellString(cell.v)
      : cellString(cell.w ?? cell.v);
  return { header, data };
}

function sheetToMatrix(sheet: XLSX.WorkSheet): Array<Array<{ header: string; data: string }>> {
  const ref = sheet["!ref"];
  if (!ref) {
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    return json.map((row) =>
      (row ?? []).map((value) => ({
        header: headerLabel(value),
        data: cellString(value),
      })),
    );
  }

  const range = XLSX.utils.decode_range(ref);
  const matrix: Array<Array<{ header: string; data: string }>> = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const next: Array<{ header: string; data: string }> = [];
    let empty = true;
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const parsed = fromExcelCell(sheet[address] as XLSX.CellObject | undefined);
      next.push(parsed);
      if (parsed.header || parsed.data) empty = false;
    }
    if (!empty) matrix.push(next);
  }
  return matrix;
}

function parseSheet(sheet: XLSX.WorkSheet): RawCsvParseResult {
  const matrix = sheetToMatrix(sheet);
  let headerIndex = -1;
  let bestScore = 0;
  const scan = Math.min(matrix.length, 30);
  for (let i = 0; i < scan; i += 1) {
    const score = scoreHeaderRow(matrix[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
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
    const base = cell.header;
    if (!base) return;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    headers.push(count === 0 ? base : `${base}_${count + 1}`);
    columnIndexes.push(index);
  });

  if (headers.length < 2) {
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
      const value = row[columnIndex]?.data ?? "";
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

export function parseRawXlsx(
  buffer: ArrayBuffer | Uint8Array | number[],
): RawCsvParseResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: false,
  });

  let best: RawCsvParseResult | null = null;
  let bestHeaderCount = -1;
  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheet(workbook.Sheets[sheetName]);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) continue;
    if (parsed.headers.length > bestHeaderCount) {
      best = parsed;
      bestHeaderCount = parsed.headers.length;
    }
  }

  if (!best) {
    return {
      headers: [],
      rows: [],
      errors: ["Excel file has no usable header row."],
    };
  }

  console.info("[upload] extracted headers", {
    source: "xlsx",
    count: best.headers.length,
    headers: best.headers,
  });
  return best;
}

export async function parseRawUpload(file: File): Promise<RawCsvParseResult> {
  if (isSpreadsheetFile(file)) {
    return parseRawXlsx(await file.arrayBuffer());
  }
  const parsed = parseRawCsv(await file.text());
  console.info("[upload] extracted headers", {
    source: "csv",
    count: parsed.headers.length,
    headers: parsed.headers,
  });
  return parsed;
}
