import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { FiltersProvider } from "@/lib/filters-context";
import { getOrSeedHrRecords } from "@/lib/hr-store";
import { getStoredDataset } from "@/lib/dataset-store";
import { AppErrorToast } from "@/components/ui/AppErrorToast";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-8 w-64" />
      <div className="mt-8 grid grid-cols-12 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="col-span-12 p-4 sm:col-span-6 xl:col-span-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-36" />
            <Skeleton className="mt-4 h-10 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

async function RecordsShell({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { records, error } = await getOrSeedHrRecords();
  const stored = await getStoredDataset();
  return (
    <FiltersProvider
      initialRecords={records}
      initialError={error}
      initialDataset={stored.dataset}
    >
      <AppErrorToast />
      {children}
    </FiltersProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <RecordsShell>{children}</RecordsShell>
    </Suspense>
  );
}
