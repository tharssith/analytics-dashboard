import {
  applySheetFilter,
  buildViz,
  type CustomMeasure,
  type SheetSpec,
} from "@/lib/analysis-workspace";
import type { RawCsvRow } from "@/lib/csv";
import { formatMonth, latestMonthRecords } from "@/lib/data";
import {
  isParseableTimeValue,
  parseNumber,
  type DatasetProfile,
} from "@/lib/dataset";
import {
  computeKpis,
  ragAttrition,
  ragHeadcount,
  ragOpenRoles,
  ragTimeToHire,
} from "@/lib/kpis";
import type { HrRecord, KpiId, RagStatus } from "@/lib/types";
import { inspectGenericRows } from "@/lib/upload-validate";

export type ProvenanceKind = "kpi" | "generic" | "viz";

export type ProvenanceRowRef = {
  id: string;
  label: string;
  value: number;
  hint: string;
};

export type SwingRow = ProvenanceRowRef & {
  delta: number;
  withoutValue: number;
};

export type ProvenanceResult = {
  metricId: string;
  metricLabel: string;
  kind: ProvenanceKind;
  value: number;
  formatted: string;
  sourceRowCount: number;
  usedRowCount: number;
  unusedRowCount: number;
  flaggedCount: number;
  flaggedRows: ProvenanceRowRef[];
  contributingRows: ProvenanceRowRef[];
  swingRows: SwingRow[];
  excludeKValue: number | null;
  excludeKFormatted: string;
  reverseStory: boolean;
  storyBefore: string;
  storyAfter: string;
  narrative: string;
  filterKey: string;
};

const SWING_LIMIT = 3;
const LOO_CAP = 80;

export function formatProvenanceNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (abs >= 100) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function filterKeyOf(parts: {
  startMonth?: string;
  endMonth?: string;
  department?: string;
}): string {
  return `${parts.startMonth ?? ""}|${parts.endMonth ?? ""}|${parts.department ?? "All"}`;
}

function hrRecordId(record: HrRecord): string {
  return record.id ?? `${record.month}|${record.department}`;
}

function hrLabel(record: HrRecord): string {
  return `${formatMonth(record.month)} · ${record.department}`;
}

function kpiNumeric(records: HrRecord[], id: KpiId): number | null {
  const latest = computeKpis(records).latest;
  if (!latest) return null;
  if (id === "headcount") return latest.headcount;
  if (id === "attrition") return latest.attrition_annualized * 100;
  if (id === "timeToHire") return latest.time_to_hire_days;
  return latest.open_positions;
}

function kpiStatus(records: HrRecord[], id: KpiId): RagStatus | "neutral" {
  const latest = computeKpis(records).latest;
  if (!latest) return "neutral";
  if (id === "headcount") return ragHeadcount(latest.headcount, latest.target_headcount);
  if (id === "attrition") return ragAttrition(latest.attrition_annualized);
  if (id === "timeToHire") {
    return latest.time_to_hire_days == null ? "neutral" : ragTimeToHire(latest.time_to_hire_days);
  }
  return ragOpenRoles(latest.open_positions, latest.target_headcount);
}

function kpiContribution(record: HrRecord, id: KpiId): number {
  if (id === "headcount") return record.headcount;
  if (id === "attrition") return record.attrition_count;
  if (id === "timeToHire") return record.time_to_hire_days ?? 0;
  return Math.max(0, record.target_headcount - record.headcount);
}

const KPI_LABELS: Record<KpiId, string> = {
  headcount: "Total headcount",
  attrition: "Attrition rate",
  timeToHire: "Avg time-to-hire",
  openPositions: "Open positions",
};

function packResult(input: {
  metricId: string;
  metricLabel: string;
  kind: ProvenanceKind;
  value: number;
  sourceRowCount: number;
  usedRowCount: number;
  flaggedRows: ProvenanceRowRef[];
  contributingRows: ProvenanceRowRef[];
  swingRows: SwingRow[];
  excludeKValue: number | null;
  reverseStory: boolean;
  storyBefore: string;
  storyAfter: string;
  filterKey: string;
  suffix?: string;
}): ProvenanceResult {
  const formatted = formatProvenanceNumber(input.value);
  const excludeKFormatted =
    input.excludeKValue == null ? "—" : formatProvenanceNumber(input.excludeKValue);
  const labels = input.swingRows.map((row) => row.label).join(", ");
  const narrative = input.reverseStory
    ? `False if you exclude ${labels || "the swing rows"} — the number becomes ${excludeKFormatted}. ${input.storyAfter}.`
    : `Holds even if you exclude ${labels || "any one row"}: ${excludeKFormatted}.`;
  return {
    ...input,
    formatted: input.suffix ? `${formatted}${input.suffix}` : formatted,
    unusedRowCount: Math.max(0, input.sourceRowCount - input.usedRowCount),
    flaggedCount: input.flaggedRows.length,
    excludeKFormatted: input.suffix && input.excludeKValue != null
      ? `${excludeKFormatted}${input.suffix}`
      : excludeKFormatted,
    narrative,
  };
}

function topSwings(rows: SwingRow[], keepAtLeast = 1): SwingRow[] {
  const ranked = [...rows].sort((a, b) => b.delta - a.delta);
  const limit = Math.max(0, Math.min(SWING_LIMIT, ranked.length - keepAtLeast));
  return ranked.slice(0, limit || Math.min(SWING_LIMIT, ranked.length));
}

export function hrKpiProvenance(
  filtered: HrRecord[],
  source: HrRecord[],
  kpiId: KpiId,
  filterKey: string,
): ProvenanceResult | null {
  const value = kpiNumeric(filtered, kpiId);
  if (value == null) return null;
  const used = latestMonthRecords(filtered);
  const storyBefore = kpiStatus(filtered, kpiId);
  const flaggedRows = used
    .filter((record) => kpiId === "timeToHire" && record.new_hires > 0 && record.time_to_hire_days == null)
    .map((record) => ({
      id: hrRecordId(record),
      label: hrLabel(record),
      value: record.new_hires,
      hint: "Hire count is present but time-to-hire is blank",
    }));

  const contributingRows = used.map((record) => ({
    id: hrRecordId(record),
    label: hrLabel(record),
    value: kpiContribution(record, kpiId),
    hint: `${record.headcount} HC · ${record.attrition_count} exits`,
  }));

  const swings: SwingRow[] = [];
  for (const record of used) {
    const without = filtered.filter((item) => hrRecordId(item) !== hrRecordId(record));
    const next = kpiNumeric(without, kpiId);
    if (next == null) continue;
    swings.push({
      id: hrRecordId(record),
      label: hrLabel(record),
      value: kpiContribution(record, kpiId),
      hint: `${record.headcount} HC · ${record.attrition_count} exits`,
      delta: Math.abs(value - next),
      withoutValue: next,
    });
  }
  const swingRows = topSwings(swings);
  const excludeIds = new Set(swingRows.map((row) => row.id));
  const withoutTop = filtered.filter((record) => !excludeIds.has(hrRecordId(record)));
  const excludeKValue = kpiNumeric(withoutTop, kpiId);
  const storyAfter = kpiStatus(withoutTop, kpiId);
  const movedEnough =
    excludeKValue != null && Math.abs(excludeKValue - value) / Math.max(1, Math.abs(value)) > 0.12;
  const reverseStory = storyBefore !== storyAfter || movedEnough;

  return packResult({
    metricId: kpiId,
    metricLabel: KPI_LABELS[kpiId],
    kind: "kpi",
    value,
    sourceRowCount: source.length,
    usedRowCount: used.length,
    flaggedRows,
    contributingRows,
    swingRows,
    excludeKValue,
    reverseStory,
    storyBefore: `${storyBefore} (${formatProvenanceNumber(value)}${kpiId === "attrition" ? "%" : ""})`,
    storyAfter: `${storyAfter} (${excludeKValue == null ? "—" : formatProvenanceNumber(excludeKValue)}${kpiId === "attrition" ? "%" : ""})`,
    filterKey,
    suffix: kpiId === "attrition" ? "%" : kpiId === "timeToHire" ? "d" : "",
  });
}

function genericRowId(row: RawCsvRow, index: number, headers: string[]): string {
  const named = headers.find((header) =>
    /^(id|order.?id|sku|invoice|employee.?id|customer.?id)$/i.test(header.trim()),
  );
  const fallback = headers.find((header) => /id$/i.test(header.trim()) && header.length < 28);
  const key = named ?? fallback;
  const value = key ? (row[key] ?? "").trim() : "";
  if (key && value) return `${key}=${value}`;
  return `row:${index + 1}`;
}

function genericLabel(
  row: RawCsvRow,
  profile: DatasetProfile,
  index: number,
): string {
  const id = genericRowId(row, index, profile.headers);
  const parts = [
    id.startsWith("row:") ? "" : id,
    profile.timeField ? (row[profile.timeField] ?? "").trim() : "",
    profile.categoryField ? (row[profile.categoryField] ?? "").trim() : "",
  ].filter(Boolean);
  return parts.join(" · ") || `Row ${index + 1}`;
}

function rowIndexMap(source: RawCsvRow[]): Map<RawCsvRow, number> {
  const map = new Map<RawCsvRow, number>();
  source.forEach((row, index) => map.set(row, index));
  return map;
}

export function genericMetricProvenance(
  filtered: RawCsvRow[],
  source: RawCsvRow[],
  profile: DatasetProfile,
  metricField: string,
  filterKey: string,
): ProvenanceResult | null {
  const indexes = rowIndexMap(source);
  const used: Array<{ row: RawCsvRow; index: number; value: number }> = [];
  const flaggedRows: ProvenanceRowRef[] = [];
  const timeIssues = new Set(
    inspectGenericRows(filtered, profile.timeField).map((issue) => issue.rowId),
  );

  filtered.forEach((row) => {
    const index = indexes.get(row) ?? source.indexOf(row);
    const rawIndex = index >= 0 ? index : used.length;
    const parsed = parseNumber(row[metricField] ?? "");
    const timeRaw = profile.timeField ? (row[profile.timeField] ?? "").trim() : "";
    const timeBroken =
      Boolean(profile.timeField && timeRaw && !isParseableTimeValue(timeRaw)) ||
      timeIssues.has(`r${rawIndex}`);
    if (parsed == null || timeBroken) {
      flaggedRows.push({
        id: genericRowId(row, rawIndex, profile.headers),
        label: genericLabel(row, profile, rawIndex),
        value: parsed ?? 0,
        hint: parsed == null ? `${metricField} is not a number` : `${profile.timeField} is not a real date`,
      });
    }
    if (parsed != null) used.push({ row, index: rawIndex, value: parsed });
  });

  if (used.length === 0) return null;
  const value = used.reduce((sum, item) => sum + item.value, 0);
  const contributingRows = used.slice(0, 40).map((item) => ({
    id: genericRowId(item.row, item.index, profile.headers),
    label: genericLabel(item.row, profile, item.index),
    value: item.value,
    hint: metricField,
  }));

  const ranked = [...used].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, LOO_CAP);
  const swings: SwingRow[] = ranked.map((item) => ({
    id: genericRowId(item.row, item.index, profile.headers),
    label: genericLabel(item.row, profile, item.index),
    value: item.value,
    hint: metricField,
    delta: Math.abs(item.value),
    withoutValue: value - item.value,
  }));
  const swingRows = topSwings(swings);
  const excludeKValue = value - swingRows.reduce((sum, row) => sum + row.value, 0);
  const movedEnough = Math.abs(excludeKValue - value) / Math.max(1, Math.abs(value)) > 0.2;
  const signFlip = value !== 0 && Math.sign(excludeKValue) !== Math.sign(value) && excludeKValue !== 0;
  const reverseStory = movedEnough || signFlip;

  return packResult({
    metricId: metricField,
    metricLabel: metricField,
    kind: "generic",
    value,
    sourceRowCount: source.length,
    usedRowCount: used.length,
    flaggedRows: flaggedRows.slice(0, 12),
    contributingRows,
    swingRows,
    excludeKValue,
    reverseStory,
    storyBefore: `total ${formatProvenanceNumber(value)}`,
    storyAfter: `total ${formatProvenanceNumber(excludeKValue)}`,
    filterKey,
  });
}

function measureSource(spec: SheetSpec, custom: CustomMeasure[]): string | null {
  const found = custom.find((item) => item.id === spec.measure || item.name === spec.measure);
  return found?.source ?? spec.measure;
}

function vizDirection(points: Array<{ value: number }>): number {
  if (points.length < 2) return 0;
  const previous = points[points.length - 2].value;
  const latest = points[points.length - 1].value;
  if (latest > previous) return 1;
  if (latest < previous) return -1;
  return 0;
}

export function vizProvenance(
  source: RawCsvRow[],
  viewRows: RawCsvRow[],
  spec: SheetSpec,
  custom: CustomMeasure[],
  filterKey: string,
  headers?: string[],
): ProvenanceResult | null {
  const filtered = applySheetFilter(viewRows, spec);
  const viz = buildViz(viewRows, spec, custom);
  const sourceField = measureSource(spec, custom);
  if (!sourceField || filtered.length === 0) return null;
  const headerList = headers ?? Object.keys(filtered[0] ?? {});
  const specOpen: SheetSpec = { ...spec, filterField: null, filterValue: "All" };
  const value = viz.total;
  const indexes = rowIndexMap(source);

  const scored = filtered.map((row, position) => {
    const index = indexes.get(row) ?? source.indexOf(row);
    const rawIndex = index >= 0 ? index : position;
    return {
      row,
      index: rawIndex,
      value: parseNumber(row[sourceField] ?? "") ?? 0,
    };
  });
  const candidates = [...scored]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, LOO_CAP);

  const swings: SwingRow[] = [];
  for (const item of candidates) {
    const withoutRows = filtered.filter((_, index) => scored[index] !== item);
    const next = buildViz(withoutRows, specOpen, custom).total;
    swings.push({
      id: genericRowId(item.row, item.index, headerList),
      label: [
        spec.category ? (item.row[spec.category] ?? "").trim() : "",
        genericRowId(item.row, item.index, headerList),
      ]
        .filter(Boolean)
        .join(" · "),
      value: item.value,
      hint: sourceField,
      delta: Math.abs(value - next),
      withoutValue: next,
    });
  }
  const swingRows = topSwings(swings);
  const excludeIds = new Set(swingRows.map((row) => row.id));
  const withoutTop = filtered.filter((row, index) => {
    const id = genericRowId(row, scored[index]?.index ?? index, headerList);
    return !excludeIds.has(id);
  });
  const nextViz = buildViz(withoutTop, specOpen, custom);
  const excludeKValue = nextViz.total;
  const beforeDir = vizDirection(viz.points);
  const afterDir = vizDirection(nextViz.points);
  const topBefore = viz.points[0]?.label ?? "";
  const topAfter = nextViz.points[0]?.label ?? "";
  const movedEnough = Math.abs(excludeKValue - value) / Math.max(1, Math.abs(value)) > 0.2;
  const reverseStory =
    (beforeDir !== 0 && afterDir !== 0 && beforeDir !== afterDir) ||
    (topBefore !== "" && topAfter !== "" && topBefore !== topAfter) ||
    movedEnough;

  const storyBefore =
    beforeDir === 1 ? "rising" : beforeDir === -1 ? "falling" : `led by ${topBefore || "this view"}`;
  const storyAfter =
    afterDir === 1 ? "rising" : afterDir === -1 ? "falling" : `led by ${topAfter || "this view"}`;

  return packResult({
    metricId: spec.measure ?? sourceField,
    metricLabel: viz.title,
    kind: "viz",
    value,
    sourceRowCount: source.length,
    usedRowCount: viz.rowCount,
    flaggedRows: [],
    contributingRows: scored.slice(0, 12).map((item) => ({
      id: genericRowId(item.row, item.index, headerList),
      label: genericRowId(item.row, item.index, headerList),
      value: item.value,
      hint: sourceField,
    })),
    swingRows,
    excludeKValue,
    reverseStory,
    storyBefore,
    storyAfter,
    filterKey,
  });
}

export function preferredHrKpi(records: HrRecord[]): KpiId {
  const tiles = computeKpis(records).tiles;
  const off = tiles.find((tile) => tile.status === "red") ?? tiles.find((tile) => tile.status === "amber");
  if (off && (off.id === "headcount" || off.id === "attrition" || off.id === "timeToHire" || off.id === "openPositions")) {
    return off.id;
  }
  return "headcount";
}

export function dashboardProvenance(input: {
  isHr: boolean;
  records: HrRecord[];
  sourceRecords: HrRecord[];
  dataset: DatasetProfile | null;
  genericRows: RawCsvRow[];
  sourceRows: RawCsvRow[];
  filterKey: string;
}): ProvenanceResult | null {
  if (input.isHr) {
    return hrKpiProvenance(
      input.records,
      input.sourceRecords,
      preferredHrKpi(input.records),
      input.filterKey,
    );
  }
  if (!input.dataset) return null;
  const metric = input.dataset.metricFields[0];
  if (!metric) return null;
  return genericMetricProvenance(
    input.genericRows,
    input.sourceRows,
    input.dataset,
    metric,
    input.filterKey,
  );
}
