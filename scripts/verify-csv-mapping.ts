import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  applyColumnMapping,
  parseRawCsv,
  sanitizeColumnMapping,
  skippedRowsMessage,
  suggestColumnMapping,
  validateMappedRows,
} from "../lib/csv";
import { parseRawXlsx } from "../lib/spreadsheet";
import { buildLocalProfile, filterGenericRows, toMonthKey } from "../lib/dataset";
import { inspectGenericRows, inspectRows, mappedRowsFromRaw } from "../lib/upload-validate";
import { shouldShowChoice, stageAfterChoice } from "../lib/upload-flow";

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

const sheet = XLSX.utils.aoa_to_sheet([
  [
    "Period",
    "Dept",
    "Emp Count",
    "Target HC",
    "Hires",
    "Exits",
    "Days to Hire",
    "Referral %",
    "Job Board %",
    "Agency %",
  ],
  ["2024-11", "Sales", 47, 51, 3, 2, 33, 40, 35, 25],
  ["2024-11", "Engineering", 172, 178, 4, 2, 41, 26, 34, 40],
]);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "HR");
const xlsxBuffer = XLSX.write(book, { type: "array", bookType: "xlsx" });
const xlsxRaw = parseRawXlsx(xlsxBuffer);
assert.equal(xlsxRaw.errors.length, 0);
assert.equal(xlsxRaw.rows[0]["Emp Count"], "47");
assert.equal(xlsxRaw.rows[0].Dept, "Sales");
assert.equal(xlsxRaw.rows[0]["Days to Hire"], "33");
assert.equal(xlsxRaw.rows[1]["Emp Count"], "172");
console.log(
  "xlsx parse preserves Emp Count=47, Dept=Sales, Days to Hire=33, Emp Count=172",
);

const titled = XLSX.utils.aoa_to_sheet([
  ["E1 BaseData"],
  [],
  [
    "Period",
    "Dept",
    "Emp Count",
    "Target HC",
    "Hires",
    "Exits",
    "Days to Hire",
    "Referral %",
    "Job Board %",
    "Agency %",
  ],
  ["2024-11", "Sales", 47, 51, 3, 2, 33, 40, 35, 25],
]);
const titledBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(titledBook, titled, "Cover");
const titledRaw = parseRawXlsx(
  XLSX.write(titledBook, { type: "array", bookType: "xlsx" }),
);
assert.deepEqual(titledRaw.headers.slice(0, 3), ["Period", "Dept", "Emp Count"]);
assert.equal(titledRaw.rows[0]["Emp Count"], "47");
console.log("xlsx skips title row and reads Period/Dept/Emp Count");

const fuzzy = sanitizeColumnMapping(
  {
    mapping: {
      month: "period",
      department: "DEPT",
      headcount: "emp count",
      target_headcount: "Target-HC",
    },
  },
  titledRaw.headers,
);
assert.equal(fuzzy.month, "Period");
assert.equal(fuzzy.department, "Dept");
assert.equal(fuzzy.headcount, "Emp Count");
assert.equal(fuzzy.target_headcount, "Target HC");
console.log("mapping matches xlsx headers case-insensitively");

const local = suggestColumnMapping(titledRaw.headers);
assert.equal(local.month, "Period");
assert.equal(local.department, "Dept");
assert.equal(local.headcount, "Emp Count");
assert.equal(local.target_headcount, "Target HC");
assert.equal(local.new_hires, "Hires");
assert.equal(local.attrition_count, "Exits");
assert.equal(local.time_to_hire_days, "Days to Hire");
assert.equal(local.referral_pct, "Referral %");
assert.equal(local.job_board_pct, "Job Board %");
assert.equal(local.agency_pct, "Agency %");
console.log("local aliases map Period/Dept/Emp Count without Grok");

const salesSheet = XLSX.utils.aoa_to_sheet([
  ["Sample Sales Data - Styles 2"],
  [
    "Order Date",
    "Segment",
    "Country",
    "City",
    "Region",
    "Category",
    "Sales",
    "Quantity",
    "Discount",
    "Profit",
  ],
  [
    "2014-11-08",
    "Consumer",
    "United States",
    "Henderson",
    "South",
    "Furniture",
    261.96,
    2,
    0,
    41.91,
  ],
  [
    "2014-11-09",
    "Corporate",
    "United States",
    "Henderson",
    "South",
    "Office Supplies",
    14.62,
    2,
    0,
    6.87,
  ],
]);
salesSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
const salesBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(salesBook, salesSheet, "Orders");
const decoy = XLSX.utils.aoa_to_sheet([
  ["Style", "Fill", "Font", "Border", "Theme", "Palette", "Preview"],
  ["A", "B", "C", "D", "E", "F", "G"],
]);
XLSX.utils.book_append_sheet(salesBook, decoy, "Styles");
const salesRaw = parseRawXlsx(
  XLSX.write(salesBook, { type: "array", bookType: "xlsx" }),
);
assert.deepEqual(salesRaw.headers.slice(0, 3), [
  "Order Date",
  "Segment",
  "Country",
]);
assert.equal(salesRaw.rows[0].Segment, "Consumer");
assert.equal(salesRaw.rows.length, 2);
const salesMap = suggestColumnMapping(salesRaw.headers);
assert.equal(salesMap.headcount, "");
assert.equal(salesMap.target_headcount, "");
assert.equal(salesMap.new_hires, "");
console.log("styled sales workbook keeps Order Date headers and does not fake HR matches");

assert.equal(shouldShowChoice("choice", 12), true);
assert.equal(shouldShowChoice("choice", 0), false);
assert.equal(shouldShowChoice("roles", 12), false);
assert.equal(shouldShowChoice("mapping", 12), false);
assert.equal(stageAfterChoice("hr"), "mapping");
assert.equal(stageAfterChoice(null), "mapping");
assert.equal(stageAfterChoice("generic"), "roles");
assert.equal(stageAfterChoice("sales"), "roles");
console.log("choice screen is first for every parsed file; HR goes to mapping, other types go to roles");

const hrProfile = buildLocalProfile("northstar-hr.csv", titledRaw.headers, titledRaw.rows);
assert.equal(hrProfile.kind, "hr");
assert.equal(stageAfterChoice(hrProfile.kind), "mapping");
const salesProfile = buildLocalProfile("Power Stations.xlsx", salesRaw.headers, salesRaw.rows);
assert.equal(salesProfile.kind === "hr", false);
assert.equal(stageAfterChoice(salesProfile.kind), "roles");
console.log("Northstar HR aliases still map required fields; general files skip HR mapping");

const e1Rows = Array.from({ length: 99 }, (_, index) => {
  const id = index + 1;
  const date = id === 12 ? "098765" : `2024-09-${String((id % 28) + 1).padStart(2, "0")}`;
  return `${id},${date},East,${10 + id}`;
});
const e1Csv = ["OrderID,Date,Region,Sales", ...e1Rows].join("\n");
const e1 = parseRawCsv(e1Csv);
assert.equal(e1.rows.length, 99);
assert.equal(e1.sourceDataRows, 99);
assert.equal(e1.droppedRows.length, 0);
assert.equal(skippedRowsMessage(e1.sourceDataRows, e1.rows.length, e1.droppedRows), null);
assert.equal(e1.rows[11]?.OrderID, "12");
assert.equal(e1.rows[11]?.Date, "098765");
assert.equal(toMonthKey("098765"), null);
assert.equal(toMonthKey("2024-09-15"), "2024-09");
const e1Profile = buildLocalProfile("E1 BaseData.csv", e1.headers, e1.rows);
assert.equal(e1Profile.timeField, "Date");
const e1Issues = inspectGenericRows(e1.rows, e1Profile.timeField);
assert.equal(e1Issues.length, 1);
assert.equal(e1Issues[0]?.rowId, "r11");
assert.equal(e1Issues[0]?.value, "098765");
const e1Filtered = filterGenericRows(e1.rows, e1Profile, "2024-09", "2024-09", "All");
assert.equal(e1Filtered.length, 99);
assert.equal(e1Filtered[11]?.OrderID, "12");
console.log("E1 BaseData keeps all 99 rows and flags OrderID 12 Date=098765");

const hrBad = parseRawCsv(`month,department,headcount,target_headcount,new_hires,attrition_count,time_to_hire_days,referral_pct,job_board_pct,agency_pct
2024-11,Sales,47,51,3,2,33,40,35,25
not-a-month,Engineering,172,178,4,2,41,26,34,40
2024-11,Finance,20,22,1,0,18,50,40,10
`);
assert.equal(hrBad.rows.length, 3);
assert.equal(hrBad.sourceDataRows, 3);
const hrMapped = mappedRowsFromRaw(hrBad.rows);
const hrIssues = inspectRows(hrMapped);
assert.ok(hrIssues.some((issue) => issue.rowId === "r1" && issue.field === "month"));
const hrConverted = validateMappedRows(hrBad.rows);
assert.equal(hrConverted.records.length, 0);
assert.ok(hrConverted.errors.length > 0);
assert.equal(hrBad.rows.length, 3);
console.log("HR upload flags a bad month instead of dropping that row from the file");

