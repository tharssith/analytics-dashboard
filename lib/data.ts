import raw from "@/data/hr-monthly.json";
import {
  DEPARTMENTS,
  type Department,
  type FilterState,
  type HrDataset,
  type HrRecord,
  type MonthlyPoint,
} from "./types";

export { DEPARTMENTS };

export const dataset = raw as HrDataset;

export function uniqueMonths(records: HrRecord[] = dataset.records): string[] {
  return [...new Set(records.map((record) => record.month))].sort();
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function formatDateRange(startMonth: string, endMonth: string): string {
  return `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`;
}

export function defaultFilters(): FilterState {
  return {
    startMonth: dataset.period.start,
    endMonth: dataset.period.end,
    department: "All",
  };
}

export function filterRecords(
  records: HrRecord[],
  filters: FilterState,
): HrRecord[] {
  return records.filter((record) => {
    if (record.month < filters.startMonth || record.month > filters.endMonth) {
      return false;
    }
    if (filters.department !== "All" && record.department !== filters.department) {
      return false;
    }
    return true;
  });
}

function weightedReferral(records: HrRecord[]): number | null {
  const hired = records.filter((record) => record.new_hires > 0);
  const hireTotal = hired.reduce((sum, record) => sum + record.new_hires, 0);
  if (hireTotal === 0) return null;
  return (
    hired.reduce(
      (sum, record) => sum + record.source_of_hire.referral_pct * record.new_hires,
      0,
    ) / hireTotal
  );
}

function weightedTimeToHire(records: HrRecord[]): number | null {
  const hired = records.filter(
    (record) => record.new_hires > 0 && record.time_to_hire_days != null,
  );
  const hireTotal = hired.reduce((sum, record) => sum + record.new_hires, 0);
  if (hireTotal === 0) return null;
  return (
    hired.reduce(
      (sum, record) => sum + (record.time_to_hire_days as number) * record.new_hires,
      0,
    ) / hireTotal
  );
}

export function aggregateMonth(records: HrRecord[], month: string): MonthlyPoint {
  const headcount = records.reduce((sum, record) => sum + record.headcount, 0);
  const target = records.reduce((sum, record) => sum + record.target_headcount, 0);
  const hires = records.reduce((sum, record) => sum + record.new_hires, 0);
  const attrition = records.reduce((sum, record) => sum + record.attrition_count, 0);
  const attritionRate = headcount > 0 ? attrition / headcount : 0;

  return {
    month,
    headcount,
    target_headcount: target,
    new_hires: hires,
    attrition_count: attrition,
    time_to_hire_days: weightedTimeToHire(records),
    attrition_rate: attritionRate,
    attrition_annualized: attritionRate * 12,
    open_positions: Math.max(0, target - headcount),
    referral_pct: weightedReferral(records),
  };
}

export function aggregateByMonth(records: HrRecord[]): MonthlyPoint[] {
  const grouped = new Map<string, HrRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.month) ?? [];
    list.push(record);
    grouped.set(record.month, list);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRecords]) => aggregateMonth(monthRecords, month));
}

export function latestMonthRecords(records: HrRecord[]): HrRecord[] {
  if (records.length === 0) return [];
  const latest = records.reduce(
    (max, record) => (record.month > max ? record.month : max),
    records[0].month,
  );
  return records.filter((record) => record.month === latest);
}

export function recordsByDepartment(records: HrRecord[]): Map<Department, HrRecord[]> {
  const grouped = new Map<Department, HrRecord[]>();
  for (const department of DEPARTMENTS) {
    grouped.set(
      department,
      records.filter((record) => record.department === department),
    );
  }
  return grouped;
}
