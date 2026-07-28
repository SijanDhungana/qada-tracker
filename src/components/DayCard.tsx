"use client";

import { PRAYER_LABELS, dayLabel, type PrayerKey } from "@/lib/prayers";
import type { DayRow } from "./Dashboard";

export function DayCard({
  day,
  prayers,
  complete,
  error,
  busy,
  onToggle,
  onMarkDone,
  onRetry,
}: {
  day: DayRow;
  prayers: readonly PrayerKey[];
  complete: boolean;
  error?: string;
  busy: boolean;
  onToggle: (prayer: PrayerKey) => void;
  onMarkDone: () => void;
  onRetry: () => void;
}) {
  const doneCount = prayers.filter((prayer) => day[prayer]).length;

  return (
    <li
      className={`rounded-2xl border bg-surface p-4 shadow-sm transition ${
        complete ? "border-line/70 opacity-70" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          {complete ? (
            <span aria-hidden className="text-accent">
              ✓
            </span>
          ) : null}
          <span>{dayLabel(day)}</span>
        </h3>

        {complete ? (
          <span className="text-xs font-medium text-accent">Complete</span>
        ) : (
          <span className="text-xs tabular-nums text-muted">
            {doneCount}/{prayers.length}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {prayers.map((prayer) => {
          const checked = day[prayer];
          return (
            <button
              key={prayer}
              type="button"
              aria-pressed={checked}
              aria-label={`${PRAYER_LABELS[prayer]} on ${dayLabel(day)}`}
              onClick={() => onToggle(prayer)}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-medium transition active:scale-[0.97] ${
                checked
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-canvas text-ink"
              }`}
            >
              <span aria-hidden className={checked ? "opacity-100" : "opacity-30"}>
                ✓
              </span>
              {PRAYER_LABELS[prayer]}
            </button>
          );
        })}
      </div>

      {!complete ? (
        <button
          type="button"
          onClick={onMarkDone}
          disabled={busy}
          className="mt-3 min-h-11 w-full rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm font-semibold text-accent transition active:scale-[0.99] disabled:opacity-60"
        >
          Mark whole day done
        </button>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}
    </li>
  );
}
