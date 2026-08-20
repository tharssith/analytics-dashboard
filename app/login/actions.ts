"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function safePath(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  if (value.startsWith("/login")) return "/dashboard";
  return value;
}

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safePath(formData.get("next")),
  };
}

export async function authAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." };
  }

  const intent = String(formData.get("intent") ?? "login");
  const { email, password, next } = credentials(formData);

  if (!email || !password) {
    return { error: "Enter an email and password." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        return { error: "That email already has an account. Log in instead." };
      }
      if (message.includes("signups") || message.includes("disabled")) {
        return {
          error:
            "Sign-up is turned off in Supabase. Enable Email sign-ups in Authentication → Providers.",
        };
      }
      return { error: error.message };
    }
    if (!data.session) {
      return {
        error:
          "Account created, but email confirmation is still on. Turn off Confirm email in Supabase Authentication → Providers, then log in.",
      };
    }
    redirect(next);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password" };
  }
  redirect(next);
}

export async function loginAction(
  prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  return authAction(prev, formData);
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
