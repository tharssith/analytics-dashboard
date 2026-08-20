"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted focus:border-navy";

function plusAlias(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "you+hr@gmail.com";
  const base = local.split("+")[0];
  return `${base}+hr@${domain}`;
}

function alreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("already") || lower.includes("registered");
}

function readField(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) return "";
  return field.value;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<"auth" | "reset" | null>(null);
  const [emailForReset, setEmailForReset] = useState("");
  const [showReset, setShowReset] = useState(false);

  function go() {
    router.push(next);
    router.refresh();
  }

  async function continueWithPassword(form: HTMLFormElement) {
    const email = readField(form, "email").trim();
    const password = readField(form, "password");

    if (!email || !password) {
      form.reportValidity();
      setError("Type your email and password in the boxes above, then continue.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setInfo(null);
    setShowReset(false);
    setEmailForReset(email);
    setPending("auth");

    try {
      const supabase = createBrowserSupabase();

      const { data: signedIn, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.session) {
        go();
        return;
      }

      const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signedUp.session) {
        go();
        return;
      }

      if (signUpError && alreadyRegistered(signUpError.message)) {
        setShowReset(true);
        setError(
          `This email already has an account, but that password does not match. Send a reset email, or create a new account with ${plusAlias(email)}.`,
        );
        return;
      }

      if (signUpError) {
        const lower = signUpError.message.toLowerCase();
        if (lower.includes("invalid") && lower.includes("email")) {
          setError(
            "Use a real email address (Gmail, Outlook, school email). Addresses like @example.com are blocked.",
          );
          return;
        }
        if (lower.includes("rate limit") || lower.includes("too many")) {
          setError("Too many attempts. Wait a minute, then try again.");
          return;
        }
        if (lower.includes("signups") || lower.includes("disabled")) {
          setError(
            "Sign-up is turned off in Supabase. Enable Email sign-ups in Authentication → Providers.",
          );
          return;
        }
        setError(signUpError.message);
        return;
      }

      setError(
        signInError?.message.toLowerCase().includes("confirm")
          ? "Turn off Confirm email in Supabase Authentication → Providers, then try again."
          : "Could not sign in. Send a reset email, or try a different password.",
      );
      setShowReset(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach authentication.");
    } finally {
      setPending(null);
    }
  }

  async function sendReset() {
    const email = emailForReset.trim();
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setPending("reset");
    setError(null);
    setInfo(null);
    try {
      const supabase = createBrowserSupabase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        },
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setInfo(
        `If ${email} has an account, a reset link is on the way. You can also sign in with ${plusAlias(email)} as a new account.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void continueWithPassword(event.currentTarget);
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
          minLength={6}
          required
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-rag-red">{error}</p> : null}
      {info ? <p className="text-sm text-navy">{info}</p> : null}
      <button
        type="submit"
        name="intent"
        value="login"
        disabled={pending != null}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-navy px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === "auth" ? "Continuing…" : "Log In"}
      </button>
      <button
        type="submit"
        name="intent"
        value="signup"
        disabled={pending != null}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:border-navy/40 hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === "auth" ? "Continuing…" : "Create account"}
      </button>
      {showReset ? (
        <button
          type="button"
          disabled={pending != null}
          onClick={() => void sendReset()}
          className="inline-flex h-9 w-full items-center justify-center text-sm font-medium text-navy underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "reset" ? "Sending reset email…" : "Send password reset email"}
        </button>
      ) : null}
      <p className="text-center text-xs leading-5 text-muted">
        Both buttons sign you in if the account exists, or create it if it does
        not. Use a real email and a password of at least 6 characters.
      </p>
    </form>
  );
}
