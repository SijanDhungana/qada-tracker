"use client";

import { useState, useTransition } from "react";
import { PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import type { SunnahEntry } from "@/lib/sunnah";
import { clearSunnah, recordSunnah } from "@/lib/actions/sunnah";
import { useToast } from "./ui/Toast";

/**
 * The sunnah beside one fard prayer. Three states — unanswered, prayed, not
 * prayed — because a blank is genuinely different from a no, and tapping the
 * current answer again returns it to blank.
 */
export function SunnahMarker({
  dateKey,
  prayer,
  initial,
}: {
  dateKey: string;
  prayer: DailyPrayerKey;
  initial: SunnahEntry | null;
}) {
  const toast = useToast();
  const [answer, setAnswer] = useState<boolean | null>(initial?.prayed ?? null);
  const [pending, startTransition] = useTransition();

  function choose(prayed: boolean) {
    const previous = answer;
    const clearing = previous === prayed;
    setAnswer(clearing ? null : prayed);

    startTransition(async () => {
      const result = await (clearing
        ? clearSunnah(dateKey, prayer)
        : recordSunnah(dateKey, prayer, prayed)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setAnswer(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message: clearing
          ? `${PRAYER_LABELS[prayer]} sunnah cleared`
          : `${PRAYER_LABELS[prayer]} sunnah · ${prayed ? "prayed" : "missed"}`,
        coalesceKey: "sunnah",
      });
    });
  }

  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
      <p className="text-meta text-ink-3">Sunnah</p>
      <div
        role="group"
        aria-label={`Sunnah for ${PRAYER_LABELS[prayer]}`}
        className="flex shrink-0 gap-1.5"
      >
        {[
          { prayed: true, label: "Prayed" },
          { prayed: false, label: "Missed" },
        ].map((option) => {
          const selected = answer === option.prayed;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => choose(option.prayed)}
              className={`min-h-9 rounded-md border px-2.5 text-meta font-medium transition-colors ${
                selected
                  ? option.prayed
                    ? "border-done bg-done-wash text-done"
                    : "border-line-strong bg-surface-2 text-ink-2"
                  : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
