"use client";

import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayers";

/**
 * The check appears only when the slot is done.
 *
 * The old build drew a checkmark on every chip regardless of state, using it
 * as an affordance and a state at once, which made done and outstanding nearly
 * indistinguishable. Colour is never the only signal either — done chips carry
 * the check as well as the fill.
 */
export function PrayerChip({
  prayer,
  done,
  disabled,
  onToggle,
}: {
  prayer: PrayerKey;
  done: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={disabled}
      onClick={onToggle}
      className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border px-2.5
                  text-meta font-medium transition-colors active:bg-surface-3 disabled:opacity-50 ${
                    done
                      ? "border-done bg-done-wash text-ink"
                      : "border-line-strong bg-surface-2 text-ink-2"
                  }`}
    >
      {done ? (
        <svg viewBox="0 0 20 20" className="size-4 text-done" fill="none" aria-hidden="true">
          <path
            d="m4 10.5 4 4 8-9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {PRAYER_LABELS[prayer]}
    </button>
  );
}
