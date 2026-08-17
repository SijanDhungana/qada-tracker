"use client";

import Link from "next/link";
import { summariseDay, type WorshipCounts } from "@/lib/worship";

/**
 * A read-only glance at today's voluntary worship, linking through to the
 * screen where it's logged. The counters live on their own page because a
 * tasbih is dozens of taps and Today is already a long screen.
 */
export function WorshipCard({ counts }: { counts: WorshipCounts }) {
  const summary = summariseDay(counts);

  return (
    <section aria-labelledby="worship-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="worship-heading" className="display text-section text-ink">
          Acts of worship
        </h2>
        <Link
          href="/worship"
          className="shrink-0 rounded-sm text-meta font-medium text-brand hover:underline"
        >
          Log worship →
        </Link>
      </div>

      <Link
        href="/worship"
        className="rounded-md border border-line bg-surface px-4 py-3.5 hover:bg-surface-2"
      >
        {summary ? (
          <>
            <p className="text-body text-ink">{summary}</p>
            <p className="mt-1 text-meta text-ink-3">Today so far. Tap to add more.</p>
          </>
        ) : (
          <>
            <p className="text-body text-ink">Nothing logged today.</p>
            <p className="mt-1 text-meta text-ink-3">
              Nafl prayers, dhikr, and Qur&apos;an — all extra, none of it owed.
            </p>
          </>
        )}
      </Link>
    </section>
  );
}
