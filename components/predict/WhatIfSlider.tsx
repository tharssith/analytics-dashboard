"use client";

import { applyReferralBonus, whatIfFromLatest } from "@/lib/whatif";
import type { MonthlyPoint } from "@/lib/types";

function formatNum(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function WhatIfSlider({
  latest,
  bonusPct,
  onChange,
}: {
  latest: MonthlyPoint | null;
  bonusPct: number;
  onChange: (value: number) => void;
}) {
  const input = whatIfFromLatest(latest);
  const result = applyReferralBonus(input, bonusPct);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Referral what-if</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Shift hiring mix toward referrals. Each extra percentage point is treated
        as 0.35 fewer days to hire; faster cycles raise projected fills over six
        months.
      </p>

      <label className="mt-5 text-xs font-medium text-muted">
        Referral mix lift
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={bonusPct}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-navy"
          />
          <span className="w-10 text-right text-sm font-semibold text-navy">
            +{bonusPct}
          </span>
        </div>
      </label>

      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Referral mix</dt>
          <dd className="font-medium text-foreground">
            {input.currentReferralPct == null
              ? "—"
              : `${formatNum(input.currentReferralPct, 0)}%`}
            {result.projectedReferralPct != null && bonusPct > 0
              ? ` → ${formatNum(result.projectedReferralPct, 0)}%`
              : ""}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Time-to-hire</dt>
          <dd className="font-medium text-foreground">
            {input.currentTth == null ? "—" : `${formatNum(input.currentTth, 1)}d`}
            {result.projectedTth != null && bonusPct > 0
              ? ` → ${formatNum(result.projectedTth, 1)}d`
              : ""}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Extra hires, 6 months</dt>
          <dd className="font-medium text-foreground">
            {result.extraHiresSixMonths <= 0
              ? "0"
              : `+${formatNum(result.extraHiresSixMonths, 1)}`}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Open roles now</dt>
          <dd className="font-medium text-foreground">
            {formatNum(result.openPositions, 0)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
