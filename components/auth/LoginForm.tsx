"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/login/actions";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="mt-8 w-full max-w-sm space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      {state?.error ? (
        <p className="text-sm text-rag-red">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Signing in…" : "Log In"}
      </button>
      <p className="text-center text-xs text-muted">
        Demo access — use the credentials provided
      </p>
    </form>
  );
}
