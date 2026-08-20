import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { dataset } from "@/lib/data";
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
    const { data: session } = await auth.getSession();
    if (session?.user) redirect(next);
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
        {dataset.company.industry}
      </p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-foreground">
        Log in or create an account
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted">
        {dataset.company.name} HR Analytics
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
