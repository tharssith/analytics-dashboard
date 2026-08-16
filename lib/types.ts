export const DEPARTMENTS = [
  "Engineering",
  "Marketing",
  "Sales",
  "Support",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type DepartmentFilter = Department | "All";

export type SourceOfHire = {
  referral_pct: number;
  job_board_pct: number;
  agency_pct: number;
};

export type HrRecord = {
  month: string;
  department: Department;
  headcount: number;
  target_headcount: number;
  new_hires: number;
  attrition_count: number;
  time_to_hire_days: number | null;
  source_of_hire: SourceOfHire;
};

export type HrDataset = {
  company: {
    name: string;
    industry: string;
    hq: string;
  };
  period: {
    start: string;
    end: string;
  };
  records: HrRecord[];
};

export type FilterState = {
  startMonth: string;
  endMonth: string;
  department: DepartmentFilter;
};

export type RagStatus = "green" | "amber" | "red";

export type KpiId = "headcount" | "attrition" | "timeToHire" | "openPositions";

export type MonthlyPoint = {
  month: string;
  headcount: number;
  target_headcount: number;
  new_hires: number;
  attrition_count: number;
  time_to_hire_days: number | null;
  attrition_rate: number;
  attrition_annualized: number;
  open_positions: number;
  referral_pct: number | null;
};

export type SparkPoint = {
  month: string;
  value: number;
};

export type KpiTileModel = {
  id: KpiId;
  label: string;
  display: string;
  context: string;
  status: RagStatus | "neutral";
  expandable: boolean;
  sparkline: SparkPoint[];
};
