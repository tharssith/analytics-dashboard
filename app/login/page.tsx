import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { auth } from "@/lib/auth/server";
import { isNeonAuthConfigured } from "@/lib/auth/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";

  if (isNeonAuthConfigured()) {
    try {
      const { data: session } = await auth.getSession();
      if (session?.user) redirect(next);
    } catch {
      // Show the form if session lookup fails.
    }
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground">
        Cairn
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted">
        Log in or create an account
      </p>
      {!isNeonAuthConfigured() ? (
        <p className="mt-6 max-w-sm text-center text-sm text-rag-red">
          Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET, then reload.
        </p>
      ) : (
        <LoginForm next={next} />
      )}
    </main>
  );
}
