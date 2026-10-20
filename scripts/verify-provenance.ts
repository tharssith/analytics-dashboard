import assert from "node:assert/strict";
import { claimFromProvenance, checkClaim } from "../lib/claims";
import { parseRawCsv } from "../lib/csv";
import { buildLocalProfile } from "../lib/dataset";
import {
  genericMetricProvenance,
  hrKpiProvenance,
} from "../lib/provenance";
import type { HrRecord } from "../lib/types";

const records: HrRecord[] = [
  {
    month: "2024-11",
    department: "Sales",
    headcount: 40,
    target_headcount: 40,
    new_hires: 1,
    attrition_count: 1,
    time_to_hire_days: 20,
    source_of_hire: { referral_pct: 50, job_board_pct: 50, agency_pct: 0 },
  },
  {
    month: "2024-11",
    department: "Marketing",
    headcount: 10,
    target_headcount: 10,
    new_hires: 8,
    attrition_count: 8,
    time_to_hire_days: 20,
    source_of_hire: { referral_pct: 50, job_board_pct: 50, agency_pct: 0 },
  },
];

const attrition = hrKpiProvenance(records, records, "attrition", "2024-11|2024-11|All");
assert.ok(attrition);
assert.equal(attrition.usedRowCount, 2);
assert.equal(attrition.sourceRowCount, 2);
assert.ok(attrition.swingRows.length >= 1);
assert.ok(attrition.swingRows.some((row) => /Marketing|Sales/.test(row.label)));
assert.ok(attrition.excludeKValue != null);
assert.ok(Math.abs((attrition.excludeKValue ?? 0) - attrition.value) > 1);

const claim = claimFromProvenance(attrition);
const still = checkClaim(claim, attrition);
assert.equal(still.stillTrue, true);

const csv = parseRawCsv(`OrderID,Month,Amount
1,2024-01,10
2,2024-01,10
3,2024-01,1000
`);
const profile = buildLocalProfile("sales.csv", csv.headers, csv.rows);
const generic = genericMetricProvenance(csv.rows, csv.rows, profile, "Amount", "||All");
assert.ok(generic);
assert.equal(generic.value, 1020);
assert.ok(generic.swingRows[0].label.includes("3") || generic.swingRows[0].value === 1000);
assert.ok(generic.reverseStory);
const withoutTop = generic.excludeKValue ?? 0;
assert.ok(withoutTop < 50);
assert.ok(attrition.excludeKValue != null);

const broken = checkClaim(claim, generic);
assert.equal(broken.stillTrue, false);

console.log("verify-provenance: ok");
