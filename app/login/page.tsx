import { LoginForm } from "@/components/auth/LoginForm";
import { dataset } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
        {dataset.company.industry}
      </p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-foreground">
        Log in
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted">
        {dataset.company.name} HR Analytics
      </p>
      {!isSupabaseConfigured() ? (
        <p className="mt-6 max-w-sm text-center text-sm text-rag-red">
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
          reload.
        </p>
      ) : (
        <LoginForm next={next} />
      )}
    </main>
  );
}
