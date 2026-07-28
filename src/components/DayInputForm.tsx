"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { addMissedDays, type ActionResult } from "@/lib/actions/days";
import { inputClass, labelClass, primaryButtonClass } from "./AuthShell";

type Mode = "range" | "amount";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={primaryButtonClass} disabled={pending}>
      {pending ? "Adding days…" : label}
    </button>
  );
}

function countFromRange(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function DayInputForm({
  submitLabel = "Add these days",
  redirectTo,
  onAdded,
}: {
  submitLabel?: string;
  redirectTo?: string;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("range");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("days");
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    addMissedDays,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        setStart("");
        setEnd("");
        setAmount("");
        router.refresh();
        onAdded?.();
      }
    }
    // Only react to a fresh result object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const rangeCount = countFromRange(start, end);
  const amountCount = (() => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1) return null;
    return n * (unit === "weeks" ? 7 : unit === "months" ? 30 : 1);
  })();

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />

      <div
        role="tablist"
        aria-label="How to enter missed days"
        className="grid grid-cols-2 gap-1 rounded-xl bg-accent-soft p-1"
      >
        {(
          [
            ["range", "Pick a date range"],
            ["amount", "Quick amount"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              mode === value
                ? "bg-surface text-ink shadow-sm"
                : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "range" ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="startDate">
              First missed day
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="endDate">
              Last missed day
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
            />
          </div>
          <p className="text-sm text-muted">
            {rangeCount === null
              ? "Both dates are included in the count."
              : `That's ${rangeCount.toLocaleString()} ${rangeCount === 1 ? "day" : "days"}, each labelled with its date.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="amount">
                How many
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                inputMode="numeric"
                min={1}
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-36">
              <label className={labelClass} htmlFor="unit">
                Unit
              </label>
              <select
                id="unit"
                name="unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className={inputClass}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-muted">
            {amountCount === null
              ? "Weeks count as 7 days and months as 30 days — these are approximate."
              : `That's ${amountCount.toLocaleString()} ${amountCount === 1 ? "day" : "days"}, labelled “Day 1”, “Day 2”, and so on. Weeks count as 7 days and months as 30 — approximate.`}
          </p>
        </div>
      )}

      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
