"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type AuthState } from "@/lib/actions/auth";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "./AuthShell";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClass} disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<AuthState | undefined, FormData>(
    login,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <label className="flex min-h-11 items-center gap-3 text-body">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="size-5 rounded-sm accent-[var(--brand)]"
        />
        <span className="text-ink-2">Remember me for 30 days</span>
      </label>

      {state?.error ? (
        <div
          role="alert"
          className={errorClass}
        >
          <p>{state.error}</p>
          {state.suggestSignup ? (
            <Link
              href="/signup"
              className="mt-2 inline-block font-semibold text-brand underline underline-offset-2"
            >
              Create an account →
            </Link>
          ) : null}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
