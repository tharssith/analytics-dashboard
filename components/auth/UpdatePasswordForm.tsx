"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/login/actions";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, null);

  return (
    <form className="mt-8 w-full max-w-sm space-y-4" action={formAction}>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Current password
        <input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          minLength={8}
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        New password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
      </label>
      {state?.error ? <p className="text-sm text-rag-red">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}
