import type { MonthlyPoint } from "./types";

const DAYS_SAVED_PER_REFERRAL_PP = 0.35;
const MAX_REFERRAL_PCT = 85;
const MIN_TTH_DAYS = 14;

export type WhatIfInput = {
  currentReferralPct: number | null;
  currentTth: number | null;
  monthlyHires: number;
  openPositions: number;
};

export type WhatIfResult = {
  bonusPct: number;
  projectedReferralPct: number | null;
  projectedTth: number | null;
  tthDelta: number | null;
  projectedMonthlyHires: number;
  extraHiresSixMonths: number;
  openPositions: number;
};

export function whatIfFromLatest(latest: MonthlyPoint | null): WhatIfInput {
  return {
    currentReferralPct: latest?.referral_pct ?? null,
    currentTth: latest?.time_to_hire_days ?? null,
    monthlyHires: latest?.new_hires ?? 0,
    openPositions: latest?.open_positions ?? 0,
  };
}

export function applyReferralBonus(
  input: WhatIfInput,
  bonusPct: number,
): WhatIfResult {
  const projectedReferralPct =
    input.currentReferralPct == null
      ? null
      : Math.min(MAX_REFERRAL_PCT, input.currentReferralPct + bonusPct);

  const extraPp =
    input.currentReferralPct == null || projectedReferralPct == null
      ? 0
      : projectedReferralPct - input.currentReferralPct;

  const projectedTth =
    input.currentTth == null
      ? null
      : Math.max(MIN_TTH_DAYS, input.currentTth - extraPp * DAYS_SAVED_PER_REFERRAL_PP);

  const hireMultiplier =
    input.currentTth && projectedTth ? input.currentTth / projectedTth : 1;
  const projectedMonthlyHires = input.monthlyHires * hireMultiplier;
  const extraHiresSixMonths = (projectedMonthlyHires - input.monthlyHires) * 6;

  return {
    bonusPct,
    projectedReferralPct,
    projectedTth,
    tthDelta:
      input.currentTth == null || projectedTth == null
        ? null
        : projectedTth - input.currentTth,
    projectedMonthlyHires,
    extraHiresSixMonths,
    openPositions: input.openPositions,
  };
}
