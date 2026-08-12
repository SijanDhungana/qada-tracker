"use client";

import { PRAYER_LABELS, type PrayerKey } from "@/lib/prayers";

/**
 * The primary action. `+` logs the oldest incomplete slot of this prayer;
 * `−` takes back the most recent one logged today.
 *
 * When a prayer runs out the card locks into a cleared state rather than
 * disappearing — it is the strongest positive moment the app has.
 */
export function PrayerCounter({
  prayer,
  outstanding,
  total,
  todayCount,
  busy,
  onLog,
  onUnlog,
  onBatch,
}: {
  prayer: PrayerKey;
  outstanding: number;
  total: number;
  todayCount: number;
  busy: boolean;
  onLog: () => void;
  onUnlog: () => void;
  onBatch: () => void;
}) {
  const cleared = outstanding <= 0;
  const done = total - outstanding;
  const fraction = total > 0 ? done / total : 0;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors ${
        cleared ? "border-done/40 bg-done-wash" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-name font-medium text-ink">{PRAYER_LABELS[prayer]}</h3>
        {cleared ? (
          <span className="text-meta font-semibold text-done">Cleared</span>
        ) : (
          <span className="num text-name text-ink-3">
            {outstanding.toLocaleString()}
          </span>
        )}
      </div>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
        role="presentation"
      >
        <span
          className="block h-full rounded-full bg-done transition-[width] duration-[var(--slow)] ease-[var(--ease)]"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>

      {cleared ? (
        <p className="flex items-center gap-2 py-2 text-meta text-done">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
            <path
              d="m4 10.5 4 4 8-9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {PRAYER_LABELS[prayer]} cleared
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onUnlog}
            disabled={todayCount <= 0 || busy}
            aria-disabled={todayCount <= 0 || busy}
            aria-label={`Undo one ${PRAYER_LABELS[prayer]} logged today`}
            className="grid size-11 place-items-center rounded-md border border-line text-ink-2
                       transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
              <path
                d="M5 10h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={onBatch}
            aria-label={`Log more than one ${PRAYER_LABELS[prayer]}`}
            className="num min-w-12 rounded-md px-1 text-counter leading-none text-ink
                       transition-colors hover:text-brand"
          >
            {todayCount}
          </button>

          <button
            type="button"
            onClick={onLog}
            disabled={busy}
            aria-label={`Log one ${PRAYER_LABELS[prayer]}`}
            className="grid size-14 place-items-center rounded-md bg-brand-wash text-brand
                       transition-transform duration-[var(--fast)] active:scale-95 disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden="true">
              <path
                d="M10 5v10M5 10h10"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
