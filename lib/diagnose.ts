import { aggregateMonth, formatMonth, latestMonthRecords } from "./data";
import {
  ragAttrition,
  ragHeadcount,
  ragOpenRoles,
  ragTimeToHire,
} from "./kpis";
import type {
  Department,
  HrRecord,
  KpiId,
  RagStatus,
} from "./types";

export const ATTRITION_ON_TRACK = 12;
export const ATTRITION_RED = 18;
export const TIME_TO_HIRE_ON_TRACK = 30;
export const TIME_TO_HIRE_RED = 45;
export const HEADCOUNT_WATCH_PCT = 5;
export const HEADCOUNT_RED_PCT = 10;
export const OPEN_ON_TRACK_PCT = 5;
export const OPEN_RED_PCT = 10;

export const KPI_IDS: KpiId[] = [
  "headcount",
  "attrition",
  "timeToHire",
  "openPositions",
];

export const KPI_TITLES: Record<KpiId, string> = {
  headcount: "Headcount vs target",
  attrition: "Attrition vs threshold",
  timeToHire: "Time-to-hire vs threshold",
  openPositions: "Open roles vs target",
};

export type DiagnoseBar = {
  department: Department;
  value: number;
  status: RagStatus | "neutral";
};

export type DiagnoseModel = {
  kpiId: KpiId;
  monthLabel: string;
  varianceSentence: string;
  contributorSentence: string | null;
  showBreakdown: boolean;
  bars: DiagnoseBar[];
  barLabel: string;
};

type DeptRow = {
  department: Department;
  point: ReturnType<typeof aggregateMonth>;
};

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

function formatPct(value: number, digits = 1): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

function formatNum(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function varianceVsBand(args: {
  actual: number;
  onTrack: number;
  red: number;
  unit: string;
  redLabel: string;
  onTrackLabel: string;
}): string {
  const { actual, onTrack, red, unit, redLabel, onTrackLabel } = args;
  if (actual > red) {
    return `${formatNum(actual - red, 1)} ${unit} above the ${redLabel}`;
  }
  if (actual > onTrack) {
    return `${formatNum(actual - onTrack, 1)} ${unit} above the ${onTrackLabel}`;
  }
  return `${formatNum(onTrack - actual, 1)} ${unit} inside the ${onTrackLabel}`;
}

export function departmentRows(records: HrRecord[]): DeptRow[] {
  const latest = latestMonthRecords(records);
  const seen = new Map<Department, HrRecord[]>();
  for (const record of latest) {
    const list = seen.get(record.department) ?? [];
    list.push(record);
    seen.set(record.department, list);
  }
  return [...seen.entries()].map(([department, deptRecords]) => ({
    department,
    point: aggregateMonth(deptRecords, deptRecords[0].month),
  }));
}

export function largestContributor(
  rows: { department: Department; gap: number }[],
): { department: Department; gap: number } | null {
  const scored = rows.filter((row) => Number.isFinite(row.gap));
  if (scored.length === 0) return null;
  return scored.reduce((best, row) => (row.gap > best.gap ? row : best));
}

function headcountVariance(actual: number, target: number): string {
  const gapPct = pct(actual - target, target);
  const off = Math.abs(gapPct);
  const direction = gapPct < 0 ? "below" : "above";
  if (off <= HEADCOUNT_WATCH_PCT) {
    return `Headcount is ${formatPct(off)} ${direction} the ${formatNum(target, 0)} target, inside the 5% on-track band.`;
  }
  if (off <= HEADCOUNT_RED_PCT) {
    return `Headcount is ${formatPct(off)} ${direction} the ${formatNum(target, 0)} target, in the 5–10% watch band.`;
  }
  return `Headcount is ${formatPct(off)} ${direction} the ${formatNum(target, 0)} target — ${formatNum(off - HEADCOUNT_RED_PCT, 1)} points past the 10% red threshold.`;
}

export function diagnoseKpi(
  kpiId: KpiId,
  records: HrRecord[],
): DiagnoseModel | null {
  const latestRecords = latestMonthRecords(records);
  if (latestRecords.length === 0) return null;

  const company = aggregateMonth(latestRecords, latestRecords[0].month);
  const monthLabel = formatMonth(company.month);
  const rows = departmentRows(records);
  const showBreakdown = rows.length > 1;

  if (kpiId === "headcount") {
    const bars: DiagnoseBar[] = rows.map(({ department, point }) => ({
      department,
      value: point.headcount,
      status: ragHeadcount(point.headcount, point.target_headcount),
    }));
    const contributor = showBreakdown
      ? largestContributor(
          rows.map(({ department, point }) => ({
            department,
            gap: Math.abs(
              pct(point.headcount - point.target_headcount, point.target_headcount),
            ),
          })),
        )
      : null;
    const contributorRow = contributor
      ? rows.find((row) => row.department === contributor.department)
      : null;
    const contributorSentence =
      contributorRow && showBreakdown
        ? `${contributorRow.department} is driving this — its headcount is ${formatNum(contributorRow.point.headcount, 0)} against a ${formatNum(contributorRow.point.target_headcount, 0)} target.`
        : null;

    return {
      kpiId,
      monthLabel,
      varianceSentence: headcountVariance(
        company.headcount,
        company.target_headcount,
      ),
      contributorSentence,
      showBreakdown,
      bars,
      barLabel: "Headcount",
    };
  }

  if (kpiId === "attrition") {
    const ratePct = company.attrition_annualized * 100;
    const bars: DiagnoseBar[] = rows.map(({ department, point }) => ({
      department,
      value: point.attrition_annualized * 100,
      status: ragAttrition(point.attrition_annualized),
    }));
    const contributor = showBreakdown
      ? largestContributor(
          rows.map(({ department, point }) => ({
            department,
            gap: point.attrition_annualized * 100 - ATTRITION_ON_TRACK,
          })),
        )
      : null;
    const contributorRow = contributor
      ? rows.find((row) => row.department === contributor.department)
      : null;
    const contributorSentence =
      contributorRow && showBreakdown
        ? `${contributorRow.department} is driving this — its attrition is ${formatPct(contributorRow.point.attrition_annualized * 100)} against a ${ATTRITION_ON_TRACK}% target.`
        : null;

    return {
      kpiId,
      monthLabel,
      varianceSentence: `Attrition is ${varianceVsBand({
        actual: ratePct,
        onTrack: ATTRITION_ON_TRACK,
        red: ATTRITION_RED,
        unit: "points",
        redLabel: `${ATTRITION_RED}% red threshold`,
        onTrackLabel: `${ATTRITION_ON_TRACK}% on-track threshold`,
      })}.`,
      contributorSentence,
      showBreakdown,
      bars,
      barLabel: "Annualized attrition (%)",
    };
  }

  if (kpiId === "timeToHire") {
    const days = company.time_to_hire_days;
    const bars: DiagnoseBar[] = rows.map(({ department, point }) => ({
      department,
      value: point.time_to_hire_days ?? 0,
      status:
        point.time_to_hire_days == null
          ? "neutral"
          : ragTimeToHire(point.time_to_hire_days),
    }));
    const withHires = rows.filter((row) => row.point.time_to_hire_days != null);
    const contributor = showBreakdown
      ? largestContributor(
          withHires.map(({ department, point }) => ({
            department,
            gap: (point.time_to_hire_days as number) - TIME_TO_HIRE_ON_TRACK,
          })),
        )
      : null;
    const contributorRow = contributor
      ? withHires.find((row) => row.department === contributor.department)
      : null;
    const contributorSentence =
      contributorRow &&
      showBreakdown &&
      contributorRow.point.time_to_hire_days != null
        ? `${contributorRow.department} is driving this — its time-to-hire is ${formatNum(contributorRow.point.time_to_hire_days, 1)} days against a ${TIME_TO_HIRE_ON_TRACK}-day target.`
        : null;

    const varianceSentence =
      days == null
        ? `There were no hires in ${monthLabel}, so time-to-hire is not scored against the ${TIME_TO_HIRE_ON_TRACK}-day target.`
        : `Time-to-hire is ${varianceVsBand({
            actual: days,
            onTrack: TIME_TO_HIRE_ON_TRACK,
            red: TIME_TO_HIRE_RED,
            unit: "days",
            redLabel: `${TIME_TO_HIRE_RED}-day red threshold`,
            onTrackLabel: `${TIME_TO_HIRE_ON_TRACK}-day on-track threshold`,
          })}.`;

    return {
      kpiId,
      monthLabel,
      varianceSentence,
      contributorSentence,
      showBreakdown,
      bars,
      barLabel: "Time-to-hire (days)",
    };
  }

  const openPct = pct(company.open_positions, company.target_headcount);
  const bars: DiagnoseBar[] = rows.map(({ department, point }) => ({
    department,
    value: point.open_positions,
    status: ragOpenRoles(point.open_positions, point.target_headcount),
  }));
  const contributor = showBreakdown
    ? largestContributor(
        rows.map(({ department, point }) => ({
          department,
          gap:
            pct(point.open_positions, point.target_headcount) - OPEN_ON_TRACK_PCT,
        })),
      )
    : null;
  const contributorRow = contributor
    ? rows.find((row) => row.department === contributor.department)
    : null;
  const contributorOpenPct = contributorRow
    ? pct(
        contributorRow.point.open_positions,
        contributorRow.point.target_headcount,
      )
    : 0;
  const contributorSentence =
    contributorRow && showBreakdown
      ? `${contributorRow.department} is driving this — it has ${formatNum(contributorRow.point.open_positions, 0)} open roles (${formatPct(contributorOpenPct)} of its ${formatNum(contributorRow.point.target_headcount, 0)} target).`
      : null;

  return {
    kpiId,
    monthLabel,
    varianceSentence: `Open roles are ${varianceVsBand({
      actual: openPct,
      onTrack: OPEN_ON_TRACK_PCT,
      red: OPEN_RED_PCT,
      unit: "points",
      redLabel: `${OPEN_RED_PCT}% red threshold`,
      onTrackLabel: `${OPEN_ON_TRACK_PCT}% on-track threshold`,
    })}.`,
    contributorSentence,
    showBreakdown,
    bars,
    barLabel: "Open roles",
  };
}
