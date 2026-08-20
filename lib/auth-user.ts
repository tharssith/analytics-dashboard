import { auth } from "@/lib/auth/server";
import { isNeonAuthConfigured } from "@/lib/auth/env";

export async function requireUserId(): Promise<
  { userId: string; error: null } | { userId: null; error: string }
> {
  if (!isNeonAuthConfigured()) {
    return { userId: null, error: "Sign in required." };
  }
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { userId: null, error: "Sign in required." };
  }
  return { userId, error: null };
}
