"use client";

import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/login/actions";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

export function LoginForm({ next }: { next: string }) {
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null);
  const [signupState, signupFormAction, signupPending] = useActionState(signupAction, null);
  const pending = loginPending || signupPending;
  const error = loginState?.error || signupState?.error;

  return (
    <form className="mt-8 w-full max-w-sm space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
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
          minLength={8}
          required
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-rag-red">{error}</p> : null}
      <button
        type="submit"
        formAction={loginFormAction}
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loginPending ? "Continuing…" : "Log In"}
      </button>
      <button
        type="submit"
        formAction={signupFormAction}
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {signupPending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-xs leading-5 text-muted">
        Click Create account first. After that, use Log In with the same
        email and password (at least 8 characters).
      </p>
    </form>
  );
}
