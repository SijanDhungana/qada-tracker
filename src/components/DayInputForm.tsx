"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMissedDays } from "@/lib/actions/settings";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useToast } from "./ui/Toast";

type Mode = "range" | "amount";

function countFromRange(start: string, end: string): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

const inputClass =
  "min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink " +
  "outline-none placeholder:text-ink-3 focus:border-brand";

/**
 * Both modes produce the same thing — a number of days — so the difference is
 * spelled out rather than left to the tab label, and each shows a live preview
 * of exactly what it will add.
 */
export function DayInputForm({
  submitLabel = "Add to my list",
  perDay,
  onDone,
}: {
  submitLabel?: string;
  perDay: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("range");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("days");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rangeCount = countFromRange(start, end);
  const amountCount = (() => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) return null;
    return value * (unit === "weeks" ? 7 : unit === "months" ? 30 : 1);
  })();
  const preview = mode === "range" ? rangeCount : amountCount;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addMissedDays(
        mode === "range"
          ? { mode, startDate: start, endDate: end }
          : { mode, amount: Number(amount), unit },
      ).catch(() => ({ ok: false as const, error: "Couldn't save those days." }));

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStart("");
      setEnd("");
      setAmount("");
      toast({
        message:
          result.skipped > 0
            ? `${result.added.toLocaleString()} days added · ${result.skipped.toLocaleString()} already tracked`
            : `${result.added.toLocaleString()} days added.`,
      });
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="How to enter missed days"
        value={mode}
        onChange={setMode}
        options={[
          { value: "range", label: "By date range" },
          { value: "amount", label: "By amount" },
        ]}
      />

      {mode === "range" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="startDate" className="mb-1.5 block text-meta text-ink-2">
              First missed day
            </label>
            <input
              id="startDate"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1.5 block text-meta text-ink-2">
              Last missed day
            </label>
            <input
              id="endDate"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
            />
          </div>
          <p className="text-meta text-ink-3">Both dates are included in the count.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="amount" className="mb-1.5 block text-meta text-ink-2">
                How many days?
              </label>
              <input
                id="amount"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-32">
              <label htmlFor="unit" className="mb-1.5 block text-meta text-ink-2">
                Unit
              </label>
              <select
                id="unit"
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
          <p className="text-meta text-ink-3">
            These are added as days ending yesterday. Weeks count as 7 days and
            months as 30 — approximate.
          </p>
        </div>
      )}

      <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-body text-ink-2">
        {preview === null ? (
          "Adds nothing yet."
        ) : (
          <>
            Adds <span className="num text-ink">{preview.toLocaleString()}</span> days ·{" "}
            <span className="num text-ink">
              {(preview * perDay).toLocaleString()}
            </span>{" "}
            prayers
          </>
        )}
      </p>

      {error ? (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending || preview === null}
        className="min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink disabled:opacity-50"
      >
        {pending ? "Adding…" : submitLabel}
      </button>
    </div>
  );
}
