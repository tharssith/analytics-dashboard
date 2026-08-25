import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground">
        Cairn
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted">
        Set a new password
      </p>
      <UpdatePasswordForm />
    </main>
  );
}
