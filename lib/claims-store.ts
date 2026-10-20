import type { CustomMeasure, SheetSpec } from "@/lib/analysis-workspace";
import { requireUserId } from "@/lib/auth-user";
import { getSql, isNeonConfigured } from "@/lib/db";
import { getStoredDataset } from "@/lib/dataset-store";
import { getOrSeedHrRecords } from "@/lib/hr-store";
import {
  asClaim,
  checkClaim,
  type ClaimCheck,
  type DatasetClaim,
} from "@/lib/claims";
import {
  dashboardProvenance,
  filterKeyOf,
  genericMetricProvenance,
  hrKpiProvenance,
  vizProvenance,
} from "@/lib/provenance";
import type { KpiId } from "@/lib/types";
import { filterRecords } from "@/lib/data";
import { filterGenericRows } from "@/lib/dataset";

const CLAIM_CAP = 25;

function publicError(error: unknown): string {
  if (!isNeonConfigured()) {
    return "Neon is not configured. Set DATABASE_URL on Vercel, then redeploy.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not load claims.";
}

export async function listClaims(): Promise<{ claims: DatasetClaim[]; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { claims: [], error: authError };
    const sql = await getSql();
    const rows = (await sql`
      select payload from public.dataset_claims
      where user_id = ${userId}
      order by created_at desc
      limit ${CLAIM_CAP}
    `) as Array<{ payload: unknown }>;
    return {
      claims: rows.map((row) => asClaim(row.payload)).filter((item): item is DatasetClaim => Boolean(item)),
      error: null,
    };
  } catch (error) {
    return { claims: [], error: publicError(error) };
  }
}

export async function saveClaim(
  claim: DatasetClaim,
): Promise<{ claim: DatasetClaim | null; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { claim: null, error: authError };
    const sql = await getSql();
    await sql`
      insert into public.dataset_claims (user_id, payload)
      values (${userId}, ${JSON.stringify(claim)}::jsonb)
    `;
    const extras = (await sql`
      select id from public.dataset_claims
      where user_id = ${userId}
      order by created_at desc
      offset ${CLAIM_CAP}
    `) as Array<{ id: string }>;
    for (const extra of extras) {
      await sql`delete from public.dataset_claims where id = ${extra.id}`;
    }
    return { claim, error: null };
  } catch (error) {
    return { claim: null, error: publicError(error) };
  }
}

const KPI_IDS: KpiId[] = ["headcount", "attrition", "timeToHire", "openPositions"];

function isKpiId(value: string): value is KpiId {
  return KPI_IDS.includes(value as KpiId);
}

export async function recheckClaims(): Promise<{ checks: ClaimCheck[]; error: string | null }> {
  const listed = await listClaims();
  if (listed.error) return { checks: [], error: listed.error };
  if (listed.claims.length === 0) return { checks: [], error: null };

  const stored = await getStoredDataset();
  const loaded = await getOrSeedHrRecords();
  const dataset = stored.dataset;
  const isHr = !dataset || dataset.kind === "hr";

  const checks = listed.claims.map((claim) => {
    const [startMonth, endMonth, department] = claim.filterKey.split("|");
    if (claim.kind === "viz" && claim.spec) {
      const rows = isHr ? [] : dataset?.rows ?? [];
      const next = vizProvenance(
        rows,
        rows,
        claim.spec as SheetSpec,
        (claim.custom ?? []) as CustomMeasure[],
        claim.filterKey,
        dataset?.headers,
      );
      return checkClaim(claim, next);
    }
    if (isHr && isKpiId(claim.metricId)) {
      const records = filterRecords(loaded.records, {
        startMonth: startMonth || loaded.records[0]?.month || "",
        endMonth: endMonth || loaded.records.at(-1)?.month || "",
        department: department && department !== "All" ? department : "All",
      });
      return checkClaim(claim, hrKpiProvenance(records, loaded.records, claim.metricId, claim.filterKey));
    }
    if (dataset && dataset.kind !== "hr") {
      const filtered = filterGenericRows(
        dataset.rows,
        dataset,
        startMonth || "",
        endMonth || "",
        department || "All",
      );
      const metric = dataset.metricFields.includes(claim.metricId)
        ? claim.metricId
        : dataset.metricFields[0];
      const next = metric
        ? genericMetricProvenance(filtered, dataset.rows, dataset, metric, claim.filterKey)
        : dashboardProvenance({
            isHr: false,
            records: [],
            sourceRecords: [],
            dataset,
            genericRows: filtered,
            sourceRows: dataset.rows,
            filterKey: filterKeyOf({ startMonth, endMonth, department }),
          });
      return checkClaim(claim, next);
    }
    return checkClaim(claim, null);
  });

  return { checks, error: null };
}
