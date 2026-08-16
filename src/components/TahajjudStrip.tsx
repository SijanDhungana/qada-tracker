"use client";

import { useState, useTransition } from "react";
import {
  TAHAJJUD_LABELS,
  TAHAJJUD_STATUSES,
  type TahajjudEntry,
  type TahajjudStatus,
} from "@/lib/tahajjud";
import { formatTimeInZone } from "@/lib/time";
import { clearTahajjud, recordTahajjud } from "@/lib/actions/tahajjud";
import { useToast } from "./ui/Toast";

const STATUS_STYLES: Record<TahajjudStatus, string> = {
  prayed: "border-done bg-done-wash text-done",
  woke: "border-line-strong bg-surface-2 text-ink",
  slept: "border-line-strong bg-surface-2 text-ink-2",
};

/**
 * One answer per night. Tapping the recorded answer again clears it, so there
 * is no separate delete affordance for a single row.
 */
export function TahajjudStrip({
  today,
  timezone,
  initialEntry,
}: {
  today: string;
  timezone: string;
  initialEntry: TahajjudEntry | null;
}) {
  const toast = useToast();
  const [entry, setEntry] = useState<TahajjudEntry | null>(initialEntry);
  const [pending, startTransition] = useTransition();

  function choose(status: TahajjudStatus) {
    const previous = entry;
    const clearing = previous?.status === status;

    const optimistic: TahajjudEntry | null = clearing
      ? null
      : { prayerDate: today, status, loggedAt: new Date().toISOString() };
    setEntry(optimistic);

    startTransition(async () => {
      const result = await (clearing
        ? clearTahajjud(today)
        : recordTahajjud(today, status)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntry(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message: clearing
          ? "Tahajjud cleared"
          : `Tahajjud · ${TAHAJJUD_LABELS[status].toLowerCase()}`,
        coalesceKey: "tahajjud",
        action: {
          label: "Undo",
          run: async () => {
            setEntry(previous);
            if (previous) await recordTahajjud(today, previous.status);
            else await clearTahajjud(today);
          },
        },
      });
    });
  }

  return (
    <section aria-labelledby="tahajjud-heading" className="flex flex-col gap-3">
      <h2 id="tahajjud-heading" className="display text-section text-ink">
        Last night
      </h2>

      <div className="rounded-md border border-line bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-20">
            <p className="text-name font-medium text-ink">Tahajjud</p>
            {entry ? (
              <p className="num text-meta text-ink-3">
                {formatTimeInZone(entry.loggedAt, timezone)}
              </p>
            ) : (
              <p className="text-meta text-ink-3">Not logged</p>
            )}
          </div>

          <div role="group" aria-label="Tahajjud last night" className="flex gap-1.5">
            {TAHAJJUD_STATUSES.map((status) => {
              const selected = entry?.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => choose(status)}
                  className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                    selected
                      ? STATUS_STYLES[status]
                      : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                  }`}
                >
                  {TAHAJJUD_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
