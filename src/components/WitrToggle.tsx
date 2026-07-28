"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrackWitr } from "@/lib/actions/days";

export function WitrToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);

    startTransition(async () => {
      const result = await setTrackWitr(next).catch(() => ({
        ok: false as const,
        error: "Couldn't save. Check your connection and retry.",
      }));

      if (!result.ok) {
        setOn(!next);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-70"
      >
        <span>
          <span className="block font-medium">Track Witr</span>
          <span className="mt-0.5 block text-sm text-muted">
            Adds Witr as a 6th prayer on every day.
          </span>
        </span>
        <span
          aria-hidden
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            on ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              on ? "left-6" : "left-1"
            }`}
          />
        </span>
      </button>

      <p className="mt-2 text-xs text-muted">
        Turning this off just hides Witr — any Witr you&apos;ve already checked off
        is kept and comes back if you turn it on again.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
