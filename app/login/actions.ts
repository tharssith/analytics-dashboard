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

export async function authAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  if (!isNeonAuthConfigured()) {
    return { error: "Neon Auth is not configured." };
  }

  const intent = String(formData.get("intent") ?? "login");
  const { email, password, next } = credentials(formData);

  if (!email || !password) {
    return { error: "Enter an email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (intent === "signup") {
    const { error } = await auth.signUp.email({
      email,
      password,
      name: displayName(email),
    });
    if (error) {
      const message = (error.message ?? "Failed to create account").toLowerCase();
      if (message.includes("already") || message.includes("exists")) {
        return { error: "That email already has an account. Log in instead." };
      }
      return { error: error.message ?? "Failed to create account." };
    }
    redirect(next);
  }

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
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
