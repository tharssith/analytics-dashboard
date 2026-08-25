import Link from "next/link";
import { auth } from "@/lib/auth/server";
import { isNeonAuthConfigured } from "@/lib/auth/env";

export const dynamic = "force-dynamic";

async function demoHref(): Promise<string> {
  if (!isNeonAuthConfigured()) return "/login";
  const { data: session } = await auth.getSession();
  return session?.user ? "/dashboard" : "/login";
}

export default async function LandingPage() {
  const href = await demoHref();

  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <h1 className="max-w-xl text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Cairn
      </h1>
      <p className="mt-4 max-w-lg text-center text-sm leading-6 text-muted sm:text-base">
        Monitor, diagnose, and forecast any business dataset — with an AI that
        shows its work
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
