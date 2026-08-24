import { REQUIRED_HEADERS, recordsToRawRows, type RawCsvRow } from "@/lib/csv";
import {
  isNumericColumn,
  parseNumber,
  type StoredDataset,
} from "@/lib/dataset";
import type { HrRecord } from "@/lib/types";

export type FieldKind = "dimension" | "measure";
export type FieldRole = "time" | "category" | "metric" | "other";
export type VisualKind =
  | "column"
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "treemap"
  | "card"
  | "table"
  | "map";
export type AggKind = "sum" | "avg" | "count" | "min" | "max";
export type WorkspaceView = "report" | "data" | "model";

export type FieldInfo = {
  name: string;
  kind: FieldKind;
  role: FieldRole;
};

export type CustomMeasure = {
  id: string;
  name: string;
  source: string;
  agg: AggKind;
};

export type SheetSpec = {
  id: string;
  name: string;
  visual: VisualKind;
  category: string | null;
  measure: string | null;
  colorBy: string | null;
  filterField: string | null;
  filterValue: string;
  agg: AggKind;
  showLabels: boolean;
};

export type VizPoint = {
  label: string;
  value: number;
  [series: string]: string | number;
};

export type VizResult = {
  points: VizPoint[];
  seriesKeys: string[];
  total: number;
  rowCount: number;
  title: string;
};

const PALETTE = ["#1b365d", "#5b8a72", "#c4923a", "#c45c5c", "#64748b", "#3d5a80", "#8a6d5b"];

export const VISUAL_PALETTE = PALETTE;

export function classifyFields(
  headers: string[],
  rows: RawCsvRow[],
  dataset: StoredDataset | null,
): FieldInfo[] {
  return headers.map((name) => {
    const isTime = dataset?.timeField === name || name.toLowerCase() === "month";
    const isCategory = dataset?.categoryField === name;
    const isMetric = dataset?.metricFields.includes(name) || isNumericColumn(rows, name);
    if (isTime) return { name, kind: "dimension", role: "time" };
    if (isCategory) return { name, kind: "dimension", role: "category" };
    if (isMetric) return { name, kind: "measure", role: "metric" };
    return { name, kind: "dimension", role: "other" };
  });
}

export function workspaceTable(
  dataset: StoredDataset | null,
  isHr: boolean,
  records: HrRecord[],
  genericRows: RawCsvRow[],
): { filename: string; headers: string[]; rows: RawCsvRow[] } {
  if (!isHr && dataset) {
    return {
      filename: dataset.filename,
      headers: dataset.headers,
      rows: genericRows.length > 0 ? genericRows : dataset.rows,
    };
  }
  return {
    filename: dataset?.filename ?? "Workforce data",
    headers: [...REQUIRED_HEADERS],
    rows: recordsToRawRows(records),
  };
}

export function defaultSheet(fields: FieldInfo[], dataset: StoredDataset | null): SheetSpec {
  const time = fields.find((field) => field.role === "time")?.name ?? dataset?.timeField ?? null;
  const category =
    fields.find((field) => field.role === "category")?.name ?? dataset?.categoryField ?? null;
  const measure =
    fields.find((field) => field.kind === "measure")?.name ?? dataset?.metricFields[0] ?? null;
  return {
    id: "sheet-1",
    name: "Overview",
    visual: time ? "line" : "column",
    category: time ?? category ?? fields.find((field) => field.kind === "dimension")?.name ?? null,
    measure,
    colorBy: time && category ? category : null,
    filterField: null,
    filterValue: "All",
    agg: "sum",
    showLabels: false,
  };
}

function valueOf(row: RawCsvRow, field: string): number | null {
  return parseNumber(row[field] ?? "");
}

function aggregateValues(values: number[], agg: AggKind): number {
  if (values.length === 0) return 0;
  if (agg === "count") return values.length;
  if (agg === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (agg === "min") return Math.min(...values);
  if (agg === "max") return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

export function uniqueFieldValues(rows: RawCsvRow[], field: string, limit = 40): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = (row[field] ?? "").trim();
    if (value) seen.add(value);
    if (seen.size >= limit) break;
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function buildViz(
  rows: RawCsvRow[],
  spec: SheetSpec,
  custom: CustomMeasure[],
): VizResult {
  const measureName = spec.measure;
  const customMeasure = custom.find((item) => item.id === measureName || item.name === measureName);
  const source = customMeasure?.source ?? measureName;
  const agg = customMeasure?.agg ?? spec.agg;
  const category = spec.category;
  const colorBy = spec.colorBy && spec.colorBy !== category ? spec.colorBy : null;

  const filtered =
    spec.filterField && spec.filterValue !== "All"
      ? rows.filter((row) => (row[spec.filterField ?? ""] ?? "") === spec.filterValue)
      : rows;

  if (!source || !category) {
    return {
      points: [],
      seriesKeys: ["value"],
      total: 0,
      rowCount: filtered.length,
      title: "Add a category to Columns and a measure to Values",
    };
  }

  const groups = new Map<string, Map<string, number[]>>();
  for (const row of filtered) {
    const label = (row[category] ?? "").trim() || "Blank";
    const series = colorBy ? (row[colorBy] ?? "").trim() || "Blank" : "value";
    const parsed = valueOf(row, source);
    const bucket = groups.get(label) ?? new Map<string, number[]>();
    const list = bucket.get(series) ?? [];
    if (agg === "count" || parsed != null) list.push(parsed ?? 0);
    bucket.set(series, list);
    groups.set(label, bucket);
  }

  const seriesSet = new Set<string>();
  const totals: Array<{ label: string; total: number; series: Map<string, number> }> = [];
  for (const [label, bucket] of groups) {
    const series = new Map<string, number>();
    let total = 0;
    for (const [key, values] of bucket) {
      const next = aggregateValues(values, agg);
      series.set(key, next);
      seriesSet.add(key);
      total += next;
    }
    totals.push({ label, total, series });
  }
  totals.sort((a, b) =>
    spec.visual === "line" || spec.visual === "area"
      ? a.label.localeCompare(b.label)
      : b.total - a.total,
  );

  const top = totals.slice(0, spec.visual === "pie" || spec.visual === "donut" ? 8 : 18);
  const rest = totals.slice(top.length);
  if (rest.length > 0) {
    const series = new Map<string, number>();
    let total = 0;
    for (const item of rest) {
      total += item.total;
      for (const [key, value] of item.series) {
        series.set(key, (series.get(key) ?? 0) + value);
      }
    }
    top.push({ label: "Other", total, series });
  }

  const seriesKeys = seriesSet.size === 0 ? ["value"] : [...seriesSet].slice(0, 8);
  const points: VizPoint[] = top.map((item) => {
    const point: VizPoint = { label: item.label, value: item.total };
    for (const key of seriesKeys) {
      point[key] = item.series.get(key) ?? 0;
    }
    return point;
  });
  const grand = points.reduce((sum, point) => sum + point.value, 0);
  const displayMeasure = customMeasure?.name ?? source;

  return {
    points,
    seriesKeys,
    total: grand,
    rowCount: filtered.length,
    title: `${agg} of ${displayMeasure} by ${category}${colorBy ? ` · color ${colorBy}` : ""}`,
  };
}

export function applySheetFilter(rows: RawCsvRow[], spec: SheetSpec): RawCsvRow[] {
  if (spec.filterField && spec.filterValue !== "All") {
    return rows.filter((row) => (row[spec.filterField ?? ""] ?? "") === spec.filterValue);
  }
  return rows;
}

export function vizToExportRows(viz: VizResult): { headers: string[]; rows: RawCsvRow[] } {
  const headers = ["Category", ...viz.seriesKeys.filter((key) => key !== "value"), "Total"];
  const uniqueHeaders = [...new Set(headers)];
  const rows = viz.points.map((point) => {
    const row: RawCsvRow = {
      Category: point.label,
      Total: String(point.value),
    };
    for (const key of viz.seriesKeys) {
      row[key] = String(point[key] ?? 0);
    }
    return row;
  });
  return { headers: uniqueHeaders, rows };
}

export function looksLikeLocation(name: string): boolean {
  return /(state|city|country|region|postal|zip|lat|lon|location|province)/i.test(name);
}
