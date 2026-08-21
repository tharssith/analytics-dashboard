"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { isNeonAuthConfigured } from "@/lib/auth/env";

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

function displayName(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Analyst";
}

function alreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already") ||
    lower.includes("exists") ||
    lower.includes("registered") ||
    lower.includes("user_already_exists")
  );
}

export async function signupAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  if (!isNeonAuthConfigured()) {
    return { error: "Neon Auth is not configured." };
  }

  const { email, password, next } = credentials(formData);
  if (!email || !password) {
    return { error: "Enter an email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { error } = await auth.signUp.email({
    email,
    password,
    name: displayName(email),
  });
  if (error && !alreadyRegistered(error.message ?? "")) {
    return { error: error.message || "Could not create that account." };
  }

  if (error) {
    const signedIn = await auth.signIn.email({ email, password });
    if (signedIn.error) {
      return {
        error: "That email already has an account. Use the same password and click Log In.",
      };
    }
  }

  redirect(next);
}

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  if (!isNeonAuthConfigured()) {
    return { error: "Neon Auth is not configured." };
  }

  const { email, password, next } = credentials(formData);
  if (!email || !password) {
    return { error: "Enter an email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    return {
      error: "No account for that email yet, or the password is wrong. Click Create account if you are new.",
    };
  }
  redirect(next);
}

export async function authAction(
  prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  return loginAction(prev, formData);
}

export async function logoutAction() {
  if (isNeonAuthConfigured()) {
    await auth.signOut();
  }
  redirect("/login");
}

export async function updatePasswordAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  if (!isNeonAuthConfigured()) {
    return { error: "Neon Auth is not configured." };
  }
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const { error } = await auth.changePassword({
    currentPassword,
    newPassword: password,
  });
  if (error) return { error: error.message ?? "Could not update password." };
  redirect("/dashboard");
}
