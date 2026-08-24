import { recordsToRawRows } from "@/lib/csv";
import type { RawCsvRow } from "@/lib/csv";
import {
  KIND_LABELS,
  computeGenericAnalytics,
  toMonthKey,
  type DatasetKind,
  type StoredDataset,
} from "@/lib/dataset";
import { aggregateByMonth } from "@/lib/data";
import type { HrRecord } from "@/lib/types";

export type Direction = "up" | "down" | "flat";
export type OutcomeKind = "profit" | "loss" | "breakeven";
export type ScaleBand = "micro" | "small" | "medium" | "large" | "enterprise";

export type Movement = {
  label: string;
  previous: number;
  current: number;
  change: number;
  changePct: number;
  direction: Direction;
};

export type ScaleInfo = {
  band: ScaleBand;
  unit: string;
  typicalMagnitude: number;
  summary: string;
};

export type ExportInsight = {
  prediction: string;
  outlook: "improving" | "declining" | "stable";
  nextPeriodPct: number | null;
  drivers: string[];
};

export type ExportModel = {
  filename: string;
  kind: DatasetKind;
  kindLabel: string;
  generatedAt: string;
  rowCount: number;
  fileRowCount: number;
  columnCount: number;
  metricLabel: string;
  dateRangeLabel: string;
  categoryLabel: string;
  outcome: {
    kind: OutcomeKind;
    amount: number;
    percent: number;
    basis: string;
    headline: string;
  };
  scale: ScaleInfo;
  movements: Movement[];
  ups: Movement[];
  downs: Movement[];
  series: { label: string; value: number }[];
  forecast: {
    slope: number;
    nextLabel: string;
    nextValue: number | null;
    changePct: number | null;
    localNarrative: string;
  };
  insight: ExportInsight;
  headers: string[];
  previewRows: RawCsvRow[];
  allRows: RawCsvRow[];
};

const EXCEL_ROW_CAP = 40_000;
const PREVIEW_ROWS = 20;

function parseNumber(value: string): number | null {
  const trimmed = value.replace(/[%$,]/g, "").trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumColumn(rows: RawCsvRow[], header: string): number {
  let total = 0;
  for (const row of rows) {
    const value = parseNumber(row[header] ?? "");
    if (value != null) total += value;
  }
  return total;
}

function findHeader(headers: string[], pattern: RegExp): string | null {
  return headers.find((header) => pattern.test(header.replace(/[_-]+/g, " "))) ?? null;
}

function isInverseMetric(label: string): boolean {
  return /(cost|expense|cogs|loss|attrition|churn|downtime|deficit|write.?off)/i.test(
    label,
  );
}

function formatNumber(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function directionOf(change: number): Direction {
  if (change > 0.0001) return "up";
  if (change < -0.0001) return "down";
  return "flat";
}

function movement(
  label: string,
  previous: number,
  current: number,
): Movement {
  const change = current - previous;
  const changePct = previous === 0 ? (current === 0 ? 0 : 100) : (change / Math.abs(previous)) * 100;
  return {
    label,
    previous,
    current,
    change,
    changePct,
    direction: directionOf(change),
  };
}

function scaleBand(rows: number): ScaleBand {
  if (rows <= 50) return "micro";
  if (rows <= 500) return "small";
  if (rows <= 5_000) return "medium";
  if (rows <= 50_000) return "large";
  return "enterprise";
}

function valueUnit(typical: number): { unit: string; label: string } {
  const abs = Math.abs(typical);
  if (abs === 0) return { unit: "units", label: "near zero" };
  if (abs < 1) return { unit: "fractions / rates", label: "less than 1" };
  if (abs < 100) return { unit: "units", label: "ones to tens" };
  if (abs < 10_000) return { unit: "thousands", label: "hundreds to thousands" };
  if (abs < 1_000_000) return { unit: "hundreds of thousands", label: "10k to 1M" };
  if (abs < 1_000_000_000) return { unit: "millions", label: "millions" };
  return { unit: "billions", label: "billions" };
}

function seriesFromRows(
  rows: RawCsvRow[],
  timeField: string | null,
  metric: string,
): { label: string; value: number }[] {
  if (!timeField) return [];
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = toMonthKey(row[timeField] ?? "") ?? row[timeField]?.trim();
    const value = parseNumber(row[metric] ?? "");
    if (!key || value == null) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + value);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

function forecastFromSeries(series: { label: string; value: number }[]) {
  if (series.length < 3) {
    return {
      slope: 0,
      nextLabel: "n/a",
      nextValue: null as number | null,
      changePct: null as number | null,
      localNarrative: "Not enough periods for a trend line. Predictive analysis uses the latest totals only.",
    };
  }
  const n = series.length;
  const xs = series.map((_, index) => index);
  const ys = series.map((point) => point.value);
  const xMean = xs.reduce((sum, x) => sum + x, 0) / n;
  const yMean = ys.reduce((sum, y) => sum + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - xMean;
    sxx += dx * dx;
    sxy += dx * (ys[i] - yMean);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;
  const last = series[n - 1];
  const nextValue = intercept + slope * n;
  const changePct = last.value === 0 ? null : (slope / Math.abs(last.value)) * 100;
  const nextLabel = `${last.label} next`;
  const direction = slope > 0 ? "up" : slope < 0 ? "down" : "flat";
  return {
    slope,
    nextLabel,
    nextValue,
    changePct,
    localNarrative: `Linear forecast from ${n} periods: next reading ${formatNumber(nextValue)} (${direction}, ${formatPct(changePct ?? 0)} vs latest ${formatNumber(last.value)}).`,
  };
}

function pickMetric(headers: string[], dataset: StoredDataset | null): string {
  const profit = findHeader(headers, /\b(net\s*)?(profit|income|ebitda|pnl)\b/i);
  if (profit) return profit;
  const revenue = findHeader(headers, /\b(revenue|sales|turnover|income)\b/i);
  if (revenue) return revenue;
  if (dataset?.metricFields[0]) return dataset.metricFields[0];
  return headers.find((header) => header.toLowerCase() !== "id") ?? headers[0] ?? "value";
}

function outcomeFromParts(
  metricLabel: string,
  amount: number,
  percent: number,
  basis: string,
  inverse: boolean,
): ExportModel["outcome"] {
  const signed = inverse ? -amount : amount;
  const kind: OutcomeKind =
    Math.abs(percent) < 0.25 ? "breakeven" : signed > 0 ? "profit" : "loss";
  const word = kind === "profit" ? "Profit" : kind === "loss" ? "Loss" : "Break-even";
  return {
    kind,
    amount: signed,
    percent,
    basis,
    headline: `${word} ${formatPct(percent)} on ${metricLabel}`,
  };
}

export function buildExportModel(input: {
  filename?: string;
  dataset: StoredDataset | null;
  isHr: boolean;
  records: HrRecord[];
  genericRows: RawCsvRow[];
  headers?: string[];
  rows?: RawCsvRow[];
  dateRangeLabel: string;
  categoryLabel: string;
}): ExportModel {
  const dataset = input.dataset;
  const kind: DatasetKind = dataset?.kind ?? (input.isHr ? "hr" : "generic");
  const filename = input.filename ?? dataset?.filename ?? "Workforce data";

  let headers = input.headers;
  let rows = input.rows;
  if (!headers || !rows) {
    if (!input.isHr && dataset) {
      headers = dataset.headers;
      rows = input.genericRows.length > 0 ? input.genericRows : dataset.rows;
    } else {
      headers = [
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
      ];
      rows = recordsToRawRows(input.records);
    }
  }

  const fileRowCount = dataset?.rows.length ?? rows.length;
  const metricLabel = pickMetric(headers, dataset);
  const inverse = isInverseMetric(metricLabel);
  const timeField = dataset?.timeField ?? (headers.includes("month") ? "month" : null);
  const profitHeader = findHeader(headers, /\b(net\s*)?(profit|ebitda|pnl)\b/i);
  const revenueHeader = findHeader(headers, /\b(revenue|sales|turnover)\b/i);
  const costHeader = findHeader(headers, /\b(cost|expense|cogs)\b/i);

  let series = seriesFromRows(rows, timeField, metricLabel);
  if (series.length === 0 && input.isHr) {
    series = aggregateByMonth(input.records).map((point) => ({
      label: point.month,
      value: point.headcount,
    }));
  }
  if (series.length === 0 && dataset) {
    series = computeGenericAnalytics(rows, dataset).series;
  }

  const movements = series.slice(1).map((point, index) =>
    movement(point.label, series[index].value, point.value),
  );
  const ups = movements
    .filter((item) => item.direction === "up")
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const downs = movements
    .filter((item) => item.direction === "down")
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  let amount = 0;
  let percent = 0;
  let basis = "";

  if (profitHeader) {
    amount = sumColumn(rows, profitHeader);
    const absRevenue = revenueHeader ? Math.abs(sumColumn(rows, revenueHeader)) : Math.abs(amount);
    percent = absRevenue === 0 ? 0 : (amount / absRevenue) * 100;
    basis = `Sum of ${profitHeader}${revenueHeader ? ` as a share of ${revenueHeader}` : ""}`;
  } else if (revenueHeader && costHeader) {
    const revenue = sumColumn(rows, revenueHeader);
    const cost = sumColumn(rows, costHeader);
    amount = revenue - cost;
    percent = revenue === 0 ? 0 : (amount / Math.abs(revenue)) * 100;
    basis = `${revenueHeader} minus ${costHeader}`;
  } else if (series.length >= 2) {
    const previous = series[series.length - 2];
    const latest = series[series.length - 1];
    const move = movement(latest.label, previous.value, latest.value);
    amount = move.change;
    percent = move.changePct;
    basis = `Latest period (${latest.label}) vs prior (${previous.label}) on ${metricLabel}`;
  } else {
    const midpoint = Math.max(1, Math.floor(rows.length / 2));
    const first = rows.slice(0, midpoint).reduce((sum, row) => sum + (parseNumber(row[metricLabel] ?? "") ?? 0), 0);
    const second = rows.slice(midpoint).reduce((sum, row) => sum + (parseNumber(row[metricLabel] ?? "") ?? 0), 0);
    const move = movement("second half vs first half", first, second);
    amount = move.change;
    percent = move.changePct;
    basis = `Second half of the file vs first half on ${metricLabel} (no time column)`;
  }

  const values: number[] = [];
  for (const row of rows.slice(0, 400)) {
    const value = parseNumber(row[metricLabel] ?? "");
    if (value != null) values.push(Math.abs(value));
  }
  const typical =
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)] ??
    Math.abs(series.at(-1)?.value ?? amount);
  const band = scaleBand(fileRowCount);
  const unit = valueUnit(typical);
  const scale: ScaleInfo = {
    band,
    unit: unit.unit,
    typicalMagnitude: typical,
    summary: `Scale: ${band} file (${fileRowCount.toLocaleString("en-US")} rows × ${headers.length} columns${fileRowCount !== rows.length ? `; this export uses ${rows.length.toLocaleString("en-US")} filtered rows` : ""}). Values sit on a ${unit.unit} scale (typical magnitude ${formatNumber(typical)}, ${unit.label}). Read profit/loss against that scale — ${formatPct(percent)} is about ${formatNumber(Math.abs(amount))} of ${metricLabel}.`,
  };

  const forecast = forecastFromSeries(series);
  const outcome = outcomeFromParts(metricLabel, amount, percent, basis, inverse);
  const insight = localInsight(outcome, forecast, ups, downs, scale);

  return {
    filename,
    kind,
    kindLabel: KIND_LABELS[kind],
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    fileRowCount,
    columnCount: headers.length,
    metricLabel,
    dateRangeLabel: input.dateRangeLabel,
    categoryLabel: input.categoryLabel,
    outcome,
    scale,
    movements,
    ups,
    downs,
    series,
    forecast,
    insight,
    headers,
    previewRows: rows.slice(0, PREVIEW_ROWS),
    allRows: rows.slice(0, EXCEL_ROW_CAP),
  };
}

export function localInsight(
  outcome: ExportModel["outcome"],
  forecast: ExportModel["forecast"],
  ups: Movement[],
  downs: Movement[],
  scale: ScaleInfo,
): ExportInsight {
  const nextPeriodPct = forecast.changePct;
  const outlook =
    (nextPeriodPct ?? outcome.percent) > 1
      ? "improving"
      : (nextPeriodPct ?? outcome.percent) < -1
        ? "declining"
        : "stable";
  const topUp = ups[0];
  const topDown = downs[0];
  const drivers = [
    topUp ? `Largest up: ${topUp.label} ${formatPct(topUp.changePct)}` : "No up periods in this window",
    topDown ? `Largest down: ${topDown.label} ${formatPct(topDown.changePct)}` : "No down periods in this window",
    scale.summary,
  ];
  return {
    outlook,
    nextPeriodPct,
    drivers,
    prediction: `${outcome.headline}. ${forecast.localNarrative} Outlook is ${outlook} on a ${scale.band} ${scale.unit} scale.`,
  };
}

export function insightPayload(model: ExportModel) {
  return {
    filename: model.filename,
    kindLabel: model.kindLabel,
    rowCount: model.rowCount,
    fileRowCount: model.fileRowCount,
    columnCount: model.columnCount,
    metricLabel: model.metricLabel,
    dateRangeLabel: model.dateRangeLabel,
    categoryLabel: model.categoryLabel,
    outcome: model.outcome,
    scale: model.scale,
    ups: model.ups.slice(0, 8),
    downs: model.downs.slice(0, 8),
    forecast: model.forecast,
    series: model.series.slice(-12),
  };
}

export function formatExportNumber(value: number, digits = 1): string {
  return formatNumber(value, digits);
}

export function formatExportPct(value: number): string {
  return formatPct(value);
}
