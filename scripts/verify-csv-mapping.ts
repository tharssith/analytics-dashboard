import assert from "node:assert/strict";
import {
  applyColumnMapping,
  parseRawCsv,
  sanitizeColumnMapping,
  validateMappedRows,
} from "../lib/csv";

const csv = `Period,Dept,Emp Count,Target HC,Hires,Exits,Days to Hire,Referral %,Job Board %,Agency %
2024-11,Sales,47,51,3,2,33,40,35,25
2024-11,Engineering,172,178,4,2,41,26,34,40
`;

const raw = parseRawCsv(csv);
assert.equal(raw.errors.length, 0);
assert.equal(raw.rows.length, 2);

const sales = raw.rows[0];
const engineering = raw.rows[1];
assert.equal(sales["Emp Count"], "47");
assert.equal(sales.Dept, "Sales");
assert.equal(sales["Days to Hire"], "33");
assert.equal(engineering["Emp Count"], "172");

const mapping = sanitizeColumnMapping(
  {
    month: "Period",
    department: "Dept",
    headcount: "Emp Count",
    target_headcount: "Target HC",
    new_hires: "Hires",
    attrition_count: "Exits",
    time_to_hire_days: "Days to Hire",
    referral_pct: "Referral %",
    job_board_pct: "Job Board %",
    agency_pct: "Agency %",
  },
  raw.headers,
);

const mapped = applyColumnMapping(raw.rows, mapping);
assert.equal(mapped[0].headcount, "47");
assert.equal(mapped[0].department, "Sales");
assert.equal(mapped[0].time_to_hire_days, "33");
assert.equal(mapped[1].headcount, "172");
assert.equal(mapped[0].headcount, sales["Emp Count"]);
assert.equal(mapped[0].department, sales.Dept);
assert.equal(mapped[0].time_to_hire_days, sales["Days to Hire"]);
assert.equal(mapped[1].headcount, engineering["Emp Count"]);

const validated = validateMappedRows(mapped);
assert.equal(validated.errors.length, 0);
assert.equal(validated.records[0].headcount, 47);
assert.equal(validated.records[0].department, "Sales");
assert.equal(validated.records[0].time_to_hire_days, 33);
assert.equal(validated.records[1].headcount, 172);

console.log(
  "csv mapping preserves Emp Count=47, Dept=Sales, Days to Hire=33, Emp Count=172",
);
