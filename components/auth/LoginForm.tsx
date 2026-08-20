"use client";

import { useActionState } from "react";
import { authAction } from "@/app/login/actions";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(authAction, null);

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
          minLength={6}
          required
          className={inputClass}
        />
      </label>
      {state?.error ? (
        <p className="text-sm text-rag-red">{state.error}</p>
      ) : null}
      <button
        type="submit"
        name="intent"
        value="login"
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Working…" : "Log In"}
      </button>
      <button
        type="submit"
        name="intent"
        value="signup"
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Create account
      </button>
      <p className="text-center text-xs leading-5 text-muted">
        Anyone can create an account. Each person gets their own copy of the
        Northstar dataset.
      </p>
    </form>
  );
}
