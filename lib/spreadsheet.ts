import * as XLSX from "xlsx";
import { parseRawCsv, type RawCsvParseResult, type RawCsvRow } from "@/lib/csv";

type MatrixCell = {
  header: string;
  data: string;
  kind: "text" | "number" | "date" | "empty";
};

function cellString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        part && typeof part === "object" && "t" in (part as { t?: unknown })
          ? cellString((part as { t?: unknown }).t)
          : cellString(part),
      )
      .join("");
  }
  if (typeof value === "object") {
    const record = value as { w?: unknown; v?: unknown; r?: unknown; t?: unknown };
    if (Array.isArray(record.r)) return cellString(record.r);
    if (record.w != null && record.w !== "") return cellString(record.w);
    if (record.v != null) return cellString(record.v);
  }
  return "";
}

function headerLabel(value: unknown): string {
  return cellString(value)
    .replace(/[\u00a0\u2000-\u200b]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumericLike(text: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(text);
}

function looksLikeDate(text: string): boolean {
  return (
    /^\d{4}-\d{1,2}(-\d{1,2})?$/.test(text) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text)
  );
}

function cellKind(cell: XLSX.CellObject | undefined, header: string): MatrixCell["kind"] {
  if (!cell || (!header && cell.v == null && cell.w == null)) return "empty";
  if (cell.t === "d" || looksLikeDate(header)) return "date";
  if (cell.t === "n" || isNumericLike(header)) return "number";
  return header ? "text" : "empty";
}

function scoreHeaderRow(row: MatrixCell[], next?: MatrixCell[]): number {
  const labels = (row ?? []).filter((cell) => cell.header.length > 0);
  if (labels.length < 2) return 0;
  const unique = new Set(labels.map((cell) => cell.header.toLowerCase())).size;
  if (unique < 2) return 0;

  const textLabels = labels.filter((cell) => cell.kind === "text").length;
  if (textLabels < 2) return 0;
  const numeric = labels.filter(
    (cell) => cell.kind === "number" || cell.kind === "date",
  ).length;
  const long = labels.filter((cell) => cell.header.length > 48).length;
  const uniqueRatio = unique / labels.length;
  let score =
    textLabels * 12 +
    unique * 8 +
    uniqueRatio * 40 -
    numeric * 18 -
    long * 24;

  if (next) {
    const nextValues = next.filter((cell) => cell.header || cell.data);
    const nextNumeric = nextValues.filter(
      (cell) => cell.kind === "number" || cell.kind === "date" || isNumericLike(cell.data),
    ).length;
    if (nextNumeric >= 2) score += 55;
  }
  return score;
}

function mergeOrigin(
  merges: XLSX.Range[] | undefined,
  row: number,
  col: number,
): { r: number; c: number } | null {
  if (!merges) return null;
  for (const range of merges) {
    if (
      row >= range.s.r &&
      row <= range.e.r &&
      col >= range.s.c &&
      col <= range.e.c &&
      (row !== range.s.r || col !== range.s.c)
    ) {
      return range.s;
    }
  }
  return null;
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

function fromExcelCell(cell: XLSX.CellObject | undefined): MatrixCell {
  if (!cell) return { header: "", data: "", kind: "empty" };
  const rich =
    Array.isArray(cell.r) ? cellString(cell.r) : "";
  const header = headerLabel(rich || cell.w || cell.v);
  const data =
    typeof cell.v === "number" || typeof cell.v === "boolean"
      ? cellString(cell.v)
      : cellString(rich || cell.w || cell.v);
  return { header, data, kind: cellKind(cell, header) };
}

function sheetToMatrix(sheet: XLSX.WorkSheet): MatrixCell[][] {
  const ref = sheet["!ref"];
  if (!ref) {
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    return json.map((row) =>
      (row ?? []).map((value) => {
        const header = headerLabel(value);
        const data = cellString(value);
        const kind: MatrixCell["kind"] =
          header === "" && data === ""
            ? "empty"
            : typeof value === "number" || isNumericLike(data)
              ? "number"
              : looksLikeDate(header)
                ? "date"
                : "text";
        return { header, data, kind };
      }),
    );
  }

  const range = XLSX.utils.decode_range(ref);
  const merges = sheet["!merges"];
  const matrix: MatrixCell[][] = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const next: MatrixCell[] = [];
    let empty = true;
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const origin = mergeOrigin(merges, row, col);
      const address = XLSX.utils.encode_cell(origin ?? { r: row, c: col });
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
  const scan = Math.min(matrix.length, 40);
  for (let i = 0; i < scan; i += 1) {
    const score = scoreHeaderRow(matrix[i] ?? [], matrix[i + 1]);
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
  let bestScore = -1;
  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheet(workbook.Sheets[sheetName]);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) continue;
    const score = parsed.headers.length * 8 + Math.min(parsed.rows.length, 500);
    if (score > bestScore) {
      best = parsed;
      bestScore = score;
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
