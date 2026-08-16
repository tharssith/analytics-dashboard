import { forecastHeadcount } from "./forecast";
import { computeKpis } from "./kpis";
import type { HrRecord } from "./types";

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

export type QaDashboardValues = {
  headcount: number;
  headcountVsTarget: string;
  attritionRate: string;
  exitsThisMonth: number;
  timeToHire: string;
  hiresThisMonth: number;
  openPositions: number;
  openPositionsPct: string;
  referralMix: string;
  forecastSummary: string;
};

export function buildQaDashboardValues(records: HrRecord[]): QaDashboardValues {
  const empty: QaDashboardValues = {
    headcount: 0,
    headcountVsTarget: "no data",
    attritionRate: "n/a",
    exitsThisMonth: 0,
    timeToHire: "n/a",
    hiresThisMonth: 0,
    openPositions: 0,
    openPositionsPct: "n/a",
    referralMix: "n/a",
    forecastSummary: "Not enough history for a trend line",
  };

  const { latest, series } = computeKpis(records);
  if (!latest) return empty;

  const hcGapPct = pct(
    latest.headcount - latest.target_headcount,
    latest.target_headcount,
  );
  const openPct = pct(latest.open_positions, latest.target_headcount);
  const forecast = forecastHeadcount(series);
  const lastFuture = forecast?.points.filter((point) => point.actual == null).at(-1);

  let forecastSummary = "Not enough history for a trend line";
  if (forecast && lastFuture?.forecast != null) {
    const direction = forecast.slope >= 0 ? "up" : "down";
    const band =
      lastFuture.lower != null && lastFuture.range != null
        ? ` 95% band ${formatNumber(lastFuture.lower)} to ${formatNumber(lastFuture.lower + lastFuture.range)}`
        : "";
    forecastSummary = `${direction} to ${formatNumber(lastFuture.forecast)} by ${lastFuture.label}${band}`;
  }

  return {
    headcount: latest.headcount,
    headcountVsTarget: `${hcGapPct >= 0 ? "+" : ""}${formatNumber(hcGapPct, 1)}% vs ${formatNumber(latest.target_headcount)} target`,
    attritionRate: `${formatNumber(latest.attrition_annualized * 100, 1)}%`,
    exitsThisMonth: latest.attrition_count,
    timeToHire:
      latest.time_to_hire_days == null
        ? "n/a"
        : `${formatNumber(latest.time_to_hire_days, 1)}d`,
    hiresThisMonth: latest.new_hires,
    openPositions: latest.open_positions,
    openPositionsPct: `${formatNumber(openPct, 1)}% of target`,
    referralMix:
      latest.referral_pct == null
        ? "n/a"
        : `${formatNumber(latest.referral_pct, 0)}% referral`,
    forecastSummary,
  };
}
