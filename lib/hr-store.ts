import { cloneRecords, dataset } from "@/lib/data";
import { requireUserId } from "@/lib/auth-user";
import { getSql, isNeonConfigured } from "@/lib/db";
import type { HrRecord } from "@/lib/types";

export type HrRecordRow = {
  id: string;
  user_id: string;
  month: string;
  department: string;
  headcount: number;
  target_headcount: number;
  new_hires: number;
  attrition_count: number;
  time_to_hire_days: number | null;
  referral_pct: number;
  job_board_pct: number;
  agency_pct: number;
};

type HrPayload = ReturnType<typeof recordToPayload>;

export function rowToRecord(row: HrRecordRow): HrRecord {
  return {
    id: row.id,
    month: row.month,
    department: row.department,
    headcount: Number(row.headcount),
    target_headcount: Number(row.target_headcount),
    new_hires: Number(row.new_hires),
    attrition_count: Number(row.attrition_count),
    time_to_hire_days:
      row.time_to_hire_days === null ? null : Number(row.time_to_hire_days),
    source_of_hire: {
      referral_pct: Number(row.referral_pct),
      job_board_pct: Number(row.job_board_pct),
      agency_pct: Number(row.agency_pct),
    },
  };
}

export function recordToPayload(record: HrRecord) {
  return {
    month: record.month,
    department: record.department,
    headcount: record.headcount,
    target_headcount: record.target_headcount,
    new_hires: record.new_hires,
    attrition_count: record.attrition_count,
    time_to_hire_days: record.time_to_hire_days,
    referral_pct: record.source_of_hire.referral_pct,
    job_board_pct: record.source_of_hire.job_board_pct,
    agency_pct: record.source_of_hire.agency_pct,
  };
}

function seedPayload() {
  return cloneRecords(dataset.records).map(recordToPayload);
}

function publicError(error: unknown): string {
  if (!isNeonConfigured()) {
    return "Neon is not configured. Set DATABASE_URL on Vercel, then redeploy.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not load HR records from Neon.";
}

async function selectRecords(userId: string) {
  const sql = await getSql();
  return (await sql`
    select * from public.hr_records
    where user_id = ${userId}
    order by month asc, department asc
  `) as HrRecordRow[];
}

async function insertRecords(userId: string, rows: HrPayload[]) {
  if (rows.length === 0) return;
  const sql = await getSql();
  await sql`
    insert into public.hr_records (
      user_id, month, department, headcount, target_headcount, new_hires,
      attrition_count, time_to_hire_days, referral_pct, job_board_pct, agency_pct
    )
    select
      ${userId},
      x.month,
      x.department,
      coalesce(x.headcount, 0),
      coalesce(x.target_headcount, 0),
      coalesce(x.new_hires, 0),
      coalesce(x.attrition_count, 0),
      x.time_to_hire_days,
      coalesce(x.referral_pct, 0),
      coalesce(x.job_board_pct, 0),
      coalesce(x.agency_pct, 0)
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(
      month text,
      department text,
      headcount double precision,
      target_headcount double precision,
      new_hires double precision,
      attrition_count double precision,
      time_to_hire_days double precision,
      referral_pct double precision,
      job_board_pct double precision,
      agency_pct double precision
    )
  `;
}

export async function getOrSeedHrRecords(): Promise<{
  records: HrRecord[];
  error: string | null;
}> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { records: [], error: authError };

    const first = await selectRecords(userId);
    if (first.length > 0) {
      return { records: first.map(rowToRecord), error: null };
    }

    await insertRecords(userId, seedPayload());
    const seeded = await selectRecords(userId);
    if (seeded.length > 0) {
      return { records: seeded.map(rowToRecord), error: null };
    }
    return { records: [], error: "Could not seed HR records into Neon." };
  } catch (error) {
    return { records: [], error: publicError(error) };
  }
}

export async function updateHrRecord(
  id: string,
  record: HrRecord,
): Promise<{ record: HrRecord | null; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { record: null, error: authError };

    const payload = recordToPayload(record);
    const sql = await getSql();
    const rows = (await sql`
      update public.hr_records set
        month = ${payload.month},
        department = ${payload.department},
        headcount = ${payload.headcount},
        target_headcount = ${payload.target_headcount},
        new_hires = ${payload.new_hires},
        attrition_count = ${payload.attrition_count},
        time_to_hire_days = ${payload.time_to_hire_days},
        referral_pct = ${payload.referral_pct},
        job_board_pct = ${payload.job_board_pct},
        agency_pct = ${payload.agency_pct}
      where id = ${id}::uuid and user_id = ${userId}
      returning *
    `) as HrRecordRow[];
    if (rows.length === 0) {
      return { record: null, error: "That HR record was not found." };
    }
    return { record: rowToRecord(rows[0]), error: null };
  } catch (error) {
    return { record: null, error: publicError(error) };
  }
}

export async function replaceHrRecords(
  records: HrRecord[],
): Promise<{ records: HrRecord[]; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { records: [], error: authError };

    const sql = await getSql();
    await sql`delete from public.hr_records where user_id = ${userId}`;
    await insertRecords(userId, records.map(recordToPayload));
    const next = await selectRecords(userId);
    return { records: next.map(rowToRecord), error: null };
  } catch (error) {
    return { records: [], error: publicError(error) };
  }
}

export async function resetHrRecords(): Promise<{
  records: HrRecord[];
  error: string | null;
}> {
  return replaceHrRecords(cloneRecords(dataset.records));
}
