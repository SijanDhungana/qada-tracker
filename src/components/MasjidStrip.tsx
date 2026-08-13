"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BASE_PRAYERS, PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  STATUS_SHORT,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import { formatTimeInZone } from "@/lib/time";
import { clearMasjidPrayer, recordMasjidPrayer } from "@/lib/actions/masjid";
import { MasjidEditorSheet, type EditorTarget } from "./MasjidEditorSheet";
import { useToast } from "./ui/Toast";

const STATUS_STYLES: Record<MasjidStatus, string> = {
  masjid: "border-done bg-done-wash text-done",
  alone: "border-line-strong bg-surface-2 text-ink",
  missed: "border-line-strong bg-surface-2 text-ink-2",
};

/**
 * Today's five prayers, logged as they happen. Three answers rather than a
 * checkbox, because "prayed on my own" is the common middle case and folding
 * it into "missed" would make both the record and the tone wrong.
 */
export function MasjidStrip({
  today,
  timezone,
  initialEntries,
}: {
  today: string;
  timezone: string;
  initialEntries: MasjidEntry[];
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<Record<string, MasjidEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.prayer, entry])),
  );
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [pending, startTransition] = useTransition();

  function save(
    prayer: DailyPrayerKey,
    status: MasjidStatus,
    reason: string | null,
  ) {
    const previous = entries[prayer];
    const optimistic: MasjidEntry = {
      prayerDate: today,
      prayer,
      status,
      reason,
      loggedAt: new Date().toISOString(),
    };
    setEntries((current) => ({ ...current, [prayer]: optimistic }));

    startTransition(async () => {
      const result = await recordMasjidPrayer({
        prayerDate: today,
        prayer,
        status,
        reason,
      }).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntries((current) => {
          const next = { ...current };
          if (previous) next[prayer] = previous;
          else delete next[prayer];
          return next;
        });
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message: `${PRAYER_LABELS[prayer]} · ${STATUS_SHORT[status].toLowerCase()}`,
        coalesceKey: "masjid",
        action: {
          label: "Undo",
          run: async () => {
            setEntries((current) => {
              const next = { ...current };
              if (previous) next[prayer] = previous;
              else delete next[prayer];
              return next;
            });
            if (previous) {
              await recordMasjidPrayer({
                prayerDate: today,
                prayer,
                status: previous.status,
                reason: previous.reason,
              });
            } else {
              await clearMasjidPrayer(today, prayer);
            }
          },
        },
      });
    });
  }

  function choose(prayer: DailyPrayerKey, status: MasjidStatus) {
    // At the masjid needs no explanation; anything else offers a note.
    if (status === "masjid") save(prayer, "masjid", null);
    else
      setTarget({
        dateKey: today,
        prayer,
        status,
        reason: entries[prayer]?.reason ?? null,
        askStatus: false,
      });
  }

  const loggedCount = Object.keys(entries).length;
  const masjidCount = Object.values(entries).filter(
    (entry) => entry.status === "masjid",
  ).length;

  return (
    <section aria-labelledby="masjid-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="masjid-heading" className="display text-section text-ink">
          Today at the masjid
        </h2>
        <Link
          href="/masjid"
          className="shrink-0 rounded-sm text-meta font-medium text-brand hover:underline"
        >
          See history →
        </Link>
      </div>

      <p className="text-meta text-ink-3">
        {loggedCount === 0
          ? "Log each prayer as you pray it."
          : `${loggedCount} of ${BASE_PRAYERS.length} logged today · ${masjidCount} at the masjid`}
      </p>

      <ul className="flex flex-col gap-2">
        {BASE_PRAYERS.map((prayer) => {
          const entry = entries[prayer];
          return (
            <li
              key={prayer}
              className="rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-20">
                  <p className="text-name font-medium text-ink">
                    {PRAYER_LABELS[prayer]}
                  </p>
                  {entry ? (
                    <p className="num text-meta text-ink-3">
                      {formatTimeInZone(entry.loggedAt, timezone)}
                    </p>
                  ) : null}
                </div>

                <div
                  role="group"
                  aria-label={`Where did you pray ${PRAYER_LABELS[prayer]}?`}
                  className="flex gap-1.5"
                >
                  {MASJID_STATUSES.map((status) => {
                    const selected = entry?.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={selected}
                        disabled={pending}
                        onClick={() => choose(prayer, status)}
                        className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                          selected
                            ? STATUS_STYLES[status]
                            : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                        }`}
                      >
                        {STATUS_SHORT[status]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {entry?.reason ? (
                <p className="mt-2 text-meta text-ink-3">
                  Note: <span className="text-ink-2">{entry.reason}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <MasjidEditorSheet
        target={target}
        onClose={() => setTarget(null)}
        onSave={(status, reason) => {
          if (target) save(target.prayer, status, reason);
          setTarget(null);
        }}
      />
    </section>
  );
}
