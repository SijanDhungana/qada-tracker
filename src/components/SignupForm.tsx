"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signup, type AuthState } from "@/lib/actions/auth";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "./AuthShell";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClass} disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState | undefined, FormData>(
    signup,
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
        <p className="mt-1.5 text-meta text-ink-3">
          3–32 characters. Letters, numbers, dots, dashes and underscores.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
        <p className="mt-1.5 text-meta text-ink-3">At least 8 characters.</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className={errorClass}
        >
          {state.error}
        </p>
      ) : null}

      <p className="rounded-md border border-today/40 bg-today-wash px-3.5 py-3 text-meta text-ink-2">
        Accounts have no email address. That keeps signup simple, but it also means
        a forgotten password can&apos;t be reset — you can export your data any time
        from Settings to keep a copy.
      </p>

      <SubmitButton />
    </form>
  );
}
