/**
 * One-off generator for data/hr-monthly.json
 * Seeded so the narrative stays stable across regenerations.
 */
function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthsBetween(start, end) {
  const result = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return result;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function round(n) {
  return Math.round(n);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function roundPcts(referral, jobBoard, agency) {
  let r = round(referral);
  let j = round(jobBoard);
  let a = round(agency);
  const diff = 100 - (r + j + a);
  r += diff;
  return { referral_pct: r, job_board_pct: j, agency_pct: a };
}

const rng = mulberry32(20260816);
const months = monthsBetween("2024-09", "2026-08");

const profiles = {
  Engineering: {
    startHc: 170,
    targetStart: 178,
    targetEnd: 228,
    attrition: (t) => 2 + t * 2.4 + (rng() > 0.7 ? 1 : 0),
    hires: (t) => 3.2 + t * 2.4 + (rng() - 0.35) * 1.2,
    tth: (t) => 34 + t * 8 + (rng() - 0.5) * 6,
    mix: () => {
      const referral = 22 + rng() * 10;
      const agency = 28 + rng() * 12;
      return roundPcts(referral, 100 - referral - agency, agency);
    },
  },
  Sales: {
    startHc: 90,
    targetStart: 98,
    targetEnd: 118,
    attrition: () => (rng() > 0.45 ? 2 : 1),
    hires: () => 1 + (rng() > 0.55 ? 1 : 0) + (rng() > 0.85 ? 1 : 0),
    tth: () => 50 + rng() * 14,
    mix: () => {
      const referral = 18 + rng() * 8;
      const agency = 38 + rng() * 12;
      return roundPcts(referral, 100 - referral - agency, agency);
    },
  },
  Support: {
    startHc: 68,
    targetStart: 70,
    targetEnd: 76,
    attrition: () => (rng() > 0.72 ? 1 : 0),
    hires: () => (rng() > 0.4 ? 1 : 0) + (rng() > 0.82 ? 1 : 0),
    tth: () => 18 + rng() * 8,
    mix: () => {
      const referral = 52 + rng() * 10;
      const agency = 8 + rng() * 8;
      return roundPcts(referral, 100 - referral - agency, agency);
    },
  },
  Marketing: {
    startHc: 40,
    targetStart: 44,
    targetEnd: 52,
    attrition: (t, i) => (i % 4 === 3 ? 2 : rng() > 0.55 ? 1 : 0),
    hires: () => (rng() > 0.35 ? 1 : 0) + (rng() > 0.8 ? 1 : 0),
    tth: () => 30 + rng() * 10,
    mix: () => {
      const referral = 32 + rng() * 12;
      const agency = 22 + rng() * 10;
      return roundPcts(referral, 100 - referral - agency, agency);
    },
  },
};

const records = [];

for (const [department, profile] of Object.entries(profiles)) {
  let hc = profile.startHc;
  months.forEach((month, i) => {
    const t = i / (months.length - 1);
    const attrition_count = clamp(round(profile.attrition(t, i)), 0, 8);
    let new_hires = clamp(round(profile.hires(t, i)), 0, 8);
    if (department === "Support" && hc + new_hires - attrition_count > 76) {
      new_hires = Math.max(0, 76 - (hc - attrition_count));
    }
    if (department === "Marketing" && hc + new_hires - attrition_count > 51) {
      new_hires = Math.max(0, 51 - (hc - attrition_count));
    }
    hc = Math.max(1, hc + new_hires - attrition_count);
    const target_headcount = round(lerp(profile.targetStart, profile.targetEnd, t));
    const time_to_hire_days =
      new_hires === 0 ? null : round(clamp(profile.tth(t, i), 12, 75));
    records.push({
      month,
      department,
      headcount: hc,
      target_headcount,
      new_hires,
      attrition_count,
      time_to_hire_days,
      source_of_hire: profile.mix(),
    });
  });
}

records.sort((a, b) => a.month.localeCompare(b.month) || a.department.localeCompare(b.department));

const dataset = {
  company: {
    name: "Northstar Financial",
    industry: "Financial services",
    hq: "Chicago, IL",
  },
  period: { start: "2024-09", end: "2026-08" },
  records,
};

import { writeFileSync } from "node:fs";
writeFileSync(
  new URL("../data/hr-monthly.json", import.meta.url),
  JSON.stringify(dataset, null, 2) + "\n",
);

const last = months[months.length - 1];
const latest = records.filter((r) => r.month === last);
const hc = latest.reduce((s, r) => s + r.headcount, 0);
const tgt = latest.reduce((s, r) => s + r.target_headcount, 0);
const att = latest.reduce((s, r) => s + r.attrition_count, 0);
const hires = latest.reduce((s, r) => s + r.new_hires, 0);
const tthNum = latest.reduce(
  (s, r) => s + (r.time_to_hire_days ?? 0) * r.new_hires,
  0,
);
console.log({
  records: records.length,
  latest: last,
  headcount: hc,
  target: tgt,
  gapPct: (((tgt - hc) / tgt) * 100).toFixed(1),
  attritionAnnual: ((att / hc) * 12 * 100).toFixed(1),
  tth: (tthNum / hires).toFixed(1),
  byDept: latest.map((r) => ({
    d: r.department,
    hc: r.headcount,
    tgt: r.target_headcount,
    att: r.attrition_count,
    hires: r.new_hires,
    tth: r.time_to_hire_days,
  })),
});
