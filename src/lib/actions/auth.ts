"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export type AuthState = {
  error?: string;
  /** Set when the username doesn't exist, so the UI can offer a sign-up link. */
  suggestSignup?: boolean;
  field?: "username" | "password";
};

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

function normalizeUsername(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Auth.js derives the session cookie's lifetime from `session.maxAge`, which is
 * fixed at config time. When "remember me" is unchecked we rewrite the cookie
 * it just set, dropping Max-Age/Expires so the browser discards it on close.
 */
async function makeSessionCookieExpireOnClose() {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (!/authjs\.session-token(\.\d+)?$/.test(cookie.name)) continue;
    cookieStore.set(cookie.name, cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookie.name.startsWith("__Secure-"),
      // No maxAge and no expires => a browser-session cookie.
    });
  }
}

export async function signup(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!USERNAME_RE.test(username)) {
    return {
      error:
        "Usernames are 3–32 characters and can use letters, numbers, dots, dashes and underscores.",
      field: "username",
    };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      field: "password",
    };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match.", field: "password" };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    return { error: "That username is taken. Try another one.", field: "username" };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({ username, passwordHash });
  } catch {
    // Unique constraint — someone claimed the name between the check and here.
    return { error: "That username is taken. Try another one.", field: "username" };
  }

  await signIn("credentials", { username, password, redirect: false });
  redirect("/onboarding");
}

export async function login(
  _prev: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!username || !password) {
    return { error: "Please enter your username and password." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  // Checked up front purely so we can tell the two cases apart in the UI.
  // `authorize()` re-verifies independently — it never trusts this.
  if (!user) {
    return { error: "User not found — create an account", suggestSignup: true };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Incorrect password, try again.", field: "password" };
  }

  await signIn("credentials", { username, password, redirect: false });

  if (!remember) {
    await makeSessionCookieExpireOnClose();
  }

  redirect("/");
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
