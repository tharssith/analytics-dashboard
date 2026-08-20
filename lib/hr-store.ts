import { cloneRecords, dataset } from "@/lib/data";
import type { HrRecord } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

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

export function rowToRecord(row: HrRecordRow): HrRecord {
  return {
    id: row.id,
    month: row.month,
    department: row.department,
    headcount: row.headcount,
    target_headcount: row.target_headcount,
    new_hires: row.new_hires,
    attrition_count: row.attrition_count,
    time_to_hire_days: row.time_to_hire_days,
    source_of_hire: {
      referral_pct: row.referral_pct,
      job_board_pct: row.job_board_pct,
      agency_pct: row.agency_pct,
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

function publicError(error: { message?: string; code?: string } | null): string {
  if (!error?.message) return "Could not load HR records from the database.";
  if (error.code === "42P01" || error.message.includes("hr_records")) {
    return "Could not load HR records. Run supabase/schema.sql in the Supabase SQL editor, then try again.";
  }
  return error.message;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: "Sign in required." };
  }
  return { supabase, user, error: null };
}

async function selectRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("hr_records")
    .select("*")
    .eq("user_id", userId)
    .order("month", { ascending: true })
    .order("department", { ascending: true });
  return { data: (data as HrRecordRow[] | null) ?? [], error };
}

export async function getOrSeedHrRecords(): Promise<{
  records: HrRecord[];
  error: string | null;
}> {
  try {
    const { supabase, user, error: authError } = await requireUser();
    if (!user) return { records: [], error: authError };

    const first = await selectRecords(supabase, user.id);
    if (first.error) return { records: [], error: publicError(first.error) };
    if (first.data.length > 0) {
      return { records: first.data.map(rowToRecord), error: null };
    }

    const { error: insertError } = await supabase.from("hr_records").insert(
      seedPayload().map((row) => ({ ...row, user_id: user.id })),
    );
    const again = await selectRecords(supabase, user.id);
    if (again.error) return { records: [], error: publicError(again.error) };
    if (again.data.length > 0) {
      return { records: again.data.map(rowToRecord), error: null };
    }
    return {
      records: [],
      error: publicError(insertError),
    };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Could not load HR records.",
    };
  }
}

export async function updateHrRecord(
  id: string,
  record: HrRecord,
): Promise<{ record: HrRecord | null; error: string | null }> {
  try {
    const { supabase, user, error: authError } = await requireUser();
    if (!user) return { record: null, error: authError };

    const { data, error } = await supabase
      .from("hr_records")
      .update(recordToPayload(record))
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error || !data) {
      return { record: null, error: publicError(error) };
    }
    return { record: rowToRecord(data as HrRecordRow), error: null };
  } catch (error) {
    return {
      record: null,
      error: error instanceof Error ? error.message : "Could not save that change.",
    };
  }
}

export async function replaceHrRecords(
  records: HrRecord[],
): Promise<{ records: HrRecord[]; error: string | null }> {
  try {
    const { supabase, user, error: authError } = await requireUser();
    if (!user) return { records: [], error: authError };

    const payload = records.map(recordToPayload);
    const { error } = await supabase.rpc("replace_hr_records", { rows: payload });
    if (error) {
      const { error: deleteError } = await supabase
        .from("hr_records")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) return { records: [], error: publicError(deleteError) };
      const { error: insertError } = await supabase.from("hr_records").insert(
        payload.map((row) => ({ ...row, user_id: user.id })),
      );
      if (insertError) return { records: [], error: publicError(insertError) };
    }

    const next = await selectRecords(supabase, user.id);
    if (next.error) return { records: [], error: publicError(next.error) };
    return { records: next.data.map(rowToRecord), error: null };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Could not replace HR records.",
    };
  }
}

export async function resetHrRecords(): Promise<{
  records: HrRecord[];
  error: string | null;
}> {
  return replaceHrRecords(cloneRecords(dataset.records));
}
