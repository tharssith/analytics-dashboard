import { requireUserId } from "@/lib/auth-user";
import { getSql, isNeonConfigured } from "@/lib/db";
import type { UploadDraft } from "@/lib/upload-draft";

function publicError(error: unknown): string {
  if (!isNeonConfigured()) {
    return "Neon is not configured. Set DATABASE_URL on Vercel, then redeploy.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not load the saved draft.";
}

function asDraft(value: unknown): UploadDraft | null {
  if (!value || typeof value !== "object") return null;
  const row = value as UploadDraft;
  if (!Array.isArray(row.headers) || !Array.isArray(row.rawRows)) return null;
  if (typeof row.fileName !== "string") return null;
  return row;
}

export async function getSavedDraft(): Promise<{
  draft: UploadDraft | null;
  error: string | null;
}> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { draft: null, error: authError };
    const sql = await getSql();
    const rows = (await sql`
      select payload from public.user_upload_drafts
      where user_id = ${userId}
      limit 1
    `) as Array<{ payload: unknown }>;
    return { draft: asDraft(rows[0]?.payload), error: null };
  } catch (error) {
    return { draft: null, error: publicError(error) };
  }
}

export async function saveDraft(
  draft: UploadDraft,
): Promise<{ draft: UploadDraft | null; error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { draft: null, error: authError };
    const sql = await getSql();
    await sql`
      insert into public.user_upload_drafts (user_id, payload, updated_at)
      values (${userId}, ${JSON.stringify(draft)}::jsonb, now())
      on conflict (user_id) do update set
        payload = excluded.payload,
        updated_at = now()
    `;
    return { draft, error: null };
  } catch (error) {
    return { draft: null, error: publicError(error) };
  }
}

export async function clearSavedDraft(): Promise<{ error: string | null }> {
  try {
    const { userId, error: authError } = await requireUserId();
    if (!userId) return { error: authError };
    const sql = await getSql();
    await sql`delete from public.user_upload_drafts where user_id = ${userId}`;
    return { error: null };
  } catch (error) {
    return { error: publicError(error) };
  }
}
