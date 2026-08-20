import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { dataset } from "@/lib/data";

export default function UpdatePasswordPage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-navy">
        {dataset.company.industry}
      </p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-foreground">
        Set a new password
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted">
        {dataset.company.name} HR Analytics
      </p>
      <UpdatePasswordForm />
    </main>
  );
}
