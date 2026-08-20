import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function requireUserId(): Promise<
  { userId: string; error: null } | { userId: null; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { userId: null, error: "Sign in required." };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { userId: null, error: "Sign in required." };
  }
  return { userId: user.id, error: null };
}
