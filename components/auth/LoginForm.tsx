"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid") && lower.includes("email")) {
    return "Use a real email address (Gmail, Outlook, school email). Addresses like @example.com are blocked.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (lower.includes("already") || lower.includes("registered")) {
    return "That email already has an account. Log in instead.";
  }
  if (lower.includes("confirm")) {
    return "Turn off Confirm email in Supabase Authentication → Providers, then try again.";
  }
  if (lower.includes("signups") || lower.includes("disabled")) {
    return "Sign-up is turned off in Supabase. Enable Email sign-ups in Authentication → Providers.";
  }
  return message;
}

function readField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) return "";
  return field.value;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"login" | "signup" | null>(null);

  async function authenticate(intent: "login" | "signup", form: HTMLFormElement) {
    const email = readField(form, "email").trim();
    const password = readField(form, "password");

    if (!email || !password) {
      form.reportValidity();
      setError("Type your email and password in the boxes above, then click Create account.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setPending(intent);

    try {
      const supabase = createBrowserSupabase();

      if (intent === "signup") {
        const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(friendlyError(signUpError.message));
          return;
        }
        if (signedUp.session) {
          router.push(next);
          router.refresh();
          return;
        }
        const { data: signedIn, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signedIn.session) {
          router.push(next);
          router.refresh();
          return;
        }
        setError(
          friendlyError(
            signInError?.message ??
              "Turn off Confirm email in Supabase Authentication → Providers, then try again.",
          ),
        );
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes("confirm")
            ? friendlyError(signInError.message)
            : "No account yet, or the password is wrong. Click Create account if this is your first visit.",
        );
        return;
      }
      router.push(next);
      router.refresh();
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
    void authenticate(intent, event.currentTarget);
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
          autoComplete="new-password"
          minLength={6}
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
        {pending === "login" ? "Signing in…" : "Log In"}
      </button>
      <button
        type="submit"
        name="intent"
        value="signup"
        disabled={pending != null}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === "signup" ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-xs leading-5 text-muted">
        Type a real email and a password of at least 6 characters, then click
        Create account. Each person gets their own copy of the Northstar dataset.
      </p>
    </form>
  );
}
