"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

function readField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) return "";
  return field.value.trim();
}

function displayName(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Analyst";
}

function errorText(error: { message?: string | null; code?: string } | null): string {
  return (error?.message || error?.code || "").toLowerCase();
}

function alreadyRegistered(error: { message?: string | null; code?: string } | null): boolean {
  const text = errorText(error);
  return (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("registered") ||
    text.includes("user_already_exists")
  );
}

function invalidCredentials(error: { message?: string | null; code?: string } | null): boolean {
  const text = errorText(error);
  return (
    text.includes("invalid email") ||
    text.includes("invalid_email_or_password") ||
    text.includes("invalid password")
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"login" | "signup" | null>(null);

  async function continueWith(intent: "login" | "signup", form: HTMLFormElement) {
    const email = readField(form, "email");
    const password = readField(form, "password");
    if (!email || !password) {
      form.reportValidity();
      setError("Type your email and password, then continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError(null);
    setPending(intent);
    try {
      const signedIn = await authClient.signIn.email({ email, password });
      if (!signedIn.error) {
        router.push(next);
        router.refresh();
        return;
      }

      const signedUp = await authClient.signUp.email({
        email,
        password,
        name: displayName(email),
      });
      if (!signedUp.error) {
        const { data: createdSession } = await authClient.getSession();
        if (!createdSession?.user) {
          const afterSignUp = await authClient.signIn.email({ email, password });
          if (afterSignUp.error) {
            setError(afterSignUp.error.message || "Account created, but sign-in failed. Click Log In.");
            return;
          }
        }
        router.push(next);
        router.refresh();
        return;
      }

      if (alreadyRegistered(signedUp.error)) {
        setError("That email already has an account. Use the same password and click Log In.");
        return;
      }

      if (invalidCredentials(signedIn.error) && invalidCredentials(signedUp.error)) {
        setError("Could not sign in with that email and password. Try Create account once, then Log In.");
        return;
      }

      setError(signedUp.error.message || signedIn.error.message || "Could not sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach authentication.");
    } finally {
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent =
      submitter instanceof HTMLButtonElement && submitter.value === "signup"
        ? "signup"
        : "login";
    void continueWith(intent, event.currentTarget);
  }

  return (
    <form className="mt-8 w-full max-w-sm space-y-4" onSubmit={onSubmit}>
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
        name="intent"
        value="login"
        disabled={pending != null}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === "login" ? "Continuing…" : "Log In"}
      </button>
      <button
        type="submit"
        name="intent"
        value="signup"
        disabled={pending != null}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === "signup" ? "Continuing…" : "Create account"}
      </button>
      <p className="text-center text-xs leading-5 text-muted">
        Either button signs you in, and creates the account if it does not
        exist yet. Use a password of at least 8 characters.
      </p>
    </form>
  );
}
