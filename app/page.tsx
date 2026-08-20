import Link from "next/link";
import { dataset } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function demoHref(): Promise<string> {
  if (!isSupabaseConfigured()) return "/login";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? "/dashboard" : "/login";
}

export default async function LandingPage() {
  const href = await demoHref();

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
        {dataset.company.industry}
      </p>
      <h1 className="mt-3 max-w-xl text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {dataset.company.name} HR Analytics
      </h1>
      <p className="mt-4 max-w-lg text-center text-sm leading-6 text-muted sm:text-base">
        Monitor, diagnose, and forecast workforce health — with an AI that shows
        its work
      </p>
      <Link
        href={href}
        className="mt-8 inline-flex h-9 items-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90"
      >
        View Demo
      </Link>
    </main>
  );
}
