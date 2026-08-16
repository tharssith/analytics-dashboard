import { aggregateByMonth } from "./data";
import type {
  HrRecord,
  KpiId,
  KpiTileModel,
  MonthlyPoint,
  RagStatus,
  SparkPoint,
} from "./types";

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

export function ragFromAbsGapPct(gapPct: number): RagStatus {
  if (gapPct <= 5) return "green";
  if (gapPct <= 10) return "amber";
  return "red";
}

export function ragHeadcount(actual: number, target: number): RagStatus {
  return ragFromAbsGapPct(Math.abs(pct(actual - target, target)));
}

export function ragAttrition(annualized: number): RagStatus {
  const ratePct = annualized * 100;
  if (ratePct < 12) return "green";
  if (ratePct <= 18) return "amber";
  return "red";
}

export function ragTimeToHire(days: number): RagStatus {
  if (days <= 30) return "green";
  if (days <= 45) return "amber";
  return "red";
}

export function ragOpenRoles(open: number, target: number): RagStatus {
  return ragFromAbsGapPct(pct(open, target));
}

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function spark(
  series: MonthlyPoint[],
  pick: (point: MonthlyPoint) => number | null,
): SparkPoint[] {
  return series
    .map((point) => {
      const value = pick(point);
      return value == null ? null : { month: point.month, value };
    })
    .filter((point): point is SparkPoint => point != null);
}

export type KpiBundle = {
  series: MonthlyPoint[];
  latest: MonthlyPoint | null;
  tiles: KpiTileModel[];
};

export function computeKpis(records: HrRecord[]): KpiBundle {
  const series = aggregateByMonth(records);
  const latest = series.at(-1) ?? null;
  if (!latest) {
    return { series, latest, tiles: [] };
  }

  const hcGapPct = pct(latest.headcount - latest.target_headcount, latest.target_headcount);
  const hcStatus = ragHeadcount(latest.headcount, latest.target_headcount);
  const attritionStatus = ragAttrition(latest.attrition_annualized);
  const tth = latest.time_to_hire_days;
  const tthStatus = tth == null ? "neutral" : ragTimeToHire(tth);
  const openPct = pct(latest.open_positions, latest.target_headcount);
  const openStatus = ragOpenRoles(latest.open_positions, latest.target_headcount);

  const tiles: KpiTileModel[] = [
    {
      id: "headcount",
      label: "Total headcount",
      display: formatNumber(latest.headcount),
      context: `${hcGapPct >= 0 ? "+" : ""}${formatNumber(hcGapPct, 1)}% vs ${formatNumber(latest.target_headcount)} target`,
      status: hcStatus,
      expandable: hcStatus !== "green",
      sparkline: spark(series, (point) => point.headcount),
    },
    {
      id: "attrition",
      label: "Attrition rate",
      display: `${formatNumber(latest.attrition_annualized * 100, 1)}%`,
      context: `${latest.attrition_count} exit${latest.attrition_count === 1 ? "" : "s"} this month, annualized`,
      status: attritionStatus,
      expandable: attritionStatus !== "green",
      sparkline: spark(series, (point) => point.attrition_annualized * 100),
    },
    {
      id: "timeToHire",
      label: "Avg time-to-hire",
      display: tth == null ? "—" : `${formatNumber(tth, 1)}d`,
      context:
        tth == null
          ? "No hires in the latest month"
          : `${latest.new_hires} hire${latest.new_hires === 1 ? "" : "s"} this month`,
      status: tthStatus,
      expandable: tthStatus === "amber" || tthStatus === "red",
      sparkline: spark(series, (point) => point.time_to_hire_days),
    },
    {
      id: "openPositions",
      label: "Open positions",
      display: formatNumber(latest.open_positions),
      context: `${formatNumber(openPct, 1)}% of ${formatNumber(latest.target_headcount)} target`,
      status: openStatus,
      expandable: openStatus !== "green",
      sparkline: spark(series, (point) => point.open_positions),
    },
  ];

  return { series, latest, tiles };
}

export function tileById(tiles: KpiTileModel[], id: KpiId): KpiTileModel | undefined {
  return tiles.find((tile) => tile.id === id);
}
