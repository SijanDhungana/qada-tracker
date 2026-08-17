"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BASE_PRAYERS, PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  STATUS_SHORT,
  TIMING_LABELS,
  describeRakah,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import {
  answersFor,
  describeParts,
  hasParts,
  type PartAnswers,
  type SunnahEntry,
} from "@/lib/sunnah";
import { formatTimeInZone } from "@/lib/time";
import { clearMasjidPrayer, recordMasjidPrayer } from "@/lib/actions/masjid";
import { saveSunnahParts } from "@/lib/actions/sunnah";
import { PrayerSheet, type SheetSave, type SheetTarget } from "./PrayerSheet";
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
 *
 * The row is the quick path; tapping the prayer's name opens the whole prayer
 * — sunnah before, fard, sunnah and nafl after — in one sheet.
 */
export function MasjidStrip({
  today,
  timezone,
  initialEntries,
  trackSunnah,
  initialSunnah,
}: {
  today: string;
  timezone: string;
  initialEntries: MasjidEntry[];
  trackSunnah: boolean;
  initialSunnah: SunnahEntry[];
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<Record<string, MasjidEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.prayer, entry])),
  );
  const [sunnah, setSunnah] = useState<Record<string, PartAnswers>>(() =>
    Object.fromEntries(
      BASE_PRAYERS.map((prayer) => [
        prayer,
        answersFor(initialSunnah, today, prayer),
      ]),
    ),
  );
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [pending, startTransition] = useTransition();

  function save(prayer: DailyPrayerKey, value: SheetSave) {
    const previousEntry = entries[prayer];
    const previousParts = sunnah[prayer] ?? {};

    const optimistic: MasjidEntry | null = value.masjid
      ? {
          prayerDate: today,
          prayer,
          status: value.masjid.status,
          timing: value.masjid.timing,
          joinedRakah: value.masjid.joinedRakah,
          reason: value.masjid.reason,
          loggedAt: new Date().toISOString(),
        }
      : null;

    setEntries((current) => {
      const next = { ...current };
      if (optimistic) next[prayer] = optimistic;
      else delete next[prayer];
      return next;
    });
    setSunnah((current) => ({ ...current, [prayer]: value.parts }));

    function rollback() {
      setEntries((current) => {
        const next = { ...current };
        if (previousEntry) next[prayer] = previousEntry;
        else delete next[prayer];
        return next;
      });
      setSunnah((current) => ({ ...current, [prayer]: previousParts }));
    }

    startTransition(async () => {
      const writes: Promise<{ ok: boolean; error?: string }>[] = [];

      if (value.masjid) {
        writes.push(
          recordMasjidPrayer({
            prayerDate: today,
            prayer,
            status: value.masjid.status,
            timing: value.masjid.timing,
            joinedRakah: value.masjid.joinedRakah,
            reason: value.masjid.reason,
          }),
        );
      } else if (previousEntry) {
        // The fard answer was tapped off, so its record goes with it.
        writes.push(clearMasjidPrayer(today, prayer));
      }

      if (trackSunnah && hasParts(prayer)) {
        writes.push(saveSunnahParts(today, prayer, value.parts));
      }

      const results = await Promise.all(
        writes.map((write) =>
          write.catch(() => ({ ok: false, error: "Couldn't save that." })),
        ),
      );

      const failure = results.find((result) => !result.ok);
      if (failure) {
        rollback();
        toast({
          message: failure.error ?? "Couldn't save that.",
          tone: "danger",
        });
        return;
      }

      toast({
        message: summarise(prayer, optimistic, value.parts),
        coalesceKey: "prayer",
        action: {
          label: "Undo",
          run: async () => {
            rollback();
            if (previousEntry) {
              await recordMasjidPrayer({
                prayerDate: today,
                prayer,
                status: previousEntry.status,
                timing: previousEntry.timing,
                joinedRakah: previousEntry.joinedRakah,
                reason: previousEntry.reason,
              });
            } else {
              await clearMasjidPrayer(today, prayer);
            }
            if (trackSunnah && hasParts(prayer)) {
              await saveSunnahParts(today, prayer, previousParts);
            }
          },
        },
      });
    });
  }

  function open(prayer: DailyPrayerKey, status?: MasjidStatus) {
    const existing = entries[prayer];
    // Tapping a status button pre-selects it; tapping the name opens on
    // whatever is already recorded.
    const chosen = status ?? existing?.status;
    const keepsDetail = status === undefined || existing?.status === status;

    setTarget({
      dateKey: today,
      prayer,
      status: chosen,
      timing: keepsDetail ? (existing?.timing ?? null) : null,
      joinedRakah: keepsDetail ? (existing?.joinedRakah ?? null) : null,
      reason: keepsDetail ? (existing?.reason ?? null) : null,
      parts: sunnah[prayer] ?? {},
      showParts: trackSunnah,
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
          ? trackSunnah
            ? "Log each prayer as you pray it. Tap a name for its sunnah and nafl."
            : "Log each prayer as you pray it."
          : `${loggedCount} of ${BASE_PRAYERS.length} logged today · ${masjidCount} at the masjid`}
      </p>

      <ul className="flex flex-col gap-2">
        {BASE_PRAYERS.map((prayer) => {
          const entry = entries[prayer];
          const answers = sunnah[prayer] ?? {};
          return (
            <li
              key={prayer}
              className="rounded-md border border-line bg-surface px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={() => open(prayer)}
                  aria-label={`Open ${PRAYER_LABELS[prayer]} in full`}
                  className="min-w-20 rounded-sm text-left"
                >
                  <span className="flex items-center gap-1 text-name font-medium text-ink">
                    {PRAYER_LABELS[prayer]}
                    <span aria-hidden="true" className="text-ink-3">
                      ›
                    </span>
                  </span>
                  {entry ? (
                    <span className="num block text-meta text-ink-3">
                      {formatTimeInZone(entry.loggedAt, timezone)}
                    </span>
                  ) : null}
                </button>

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
                        onClick={() => open(prayer, status)}
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

              {entry ? <EntryDetail entry={entry} /> : null}

              {trackSunnah ? (
                <SunnahLine prayer={prayer} answers={answers} onOpen={() => open(prayer)} />
              ) : null}
            </li>
          );
        })}
      </ul>

      <PrayerSheet
        target={target}
        onClose={() => setTarget(null)}
        onSave={(value) => {
          if (target) save(target.prayer, value);
          setTarget(null);
        }}
      />
    </section>
  );
}

/** "Fajr · masjid, on time · sunnah 2" */
function summarise(
  prayer: DailyPrayerKey,
  entry: MasjidEntry | null,
  answers: PartAnswers,
): string {
  const parts: string[] = [];
  if (entry) {
    parts.push(
      entry.status === "masjid" && entry.timing
        ? `${STATUS_SHORT[entry.status].toLowerCase()}, ${TIMING_LABELS[entry.timing].toLowerCase()}`
        : STATUS_SHORT[entry.status].toLowerCase(),
    );
  }
  const sunnah = describeParts(prayer, answers);
  if (sunnah) parts.push(`sunnah ${sunnah}`);
  if (parts.length === 0) return `${PRAYER_LABELS[prayer]} cleared`;
  return `${PRAYER_LABELS[prayer]} · ${parts.join(" · ")}`;
}

/** The timing, rak'ah and note that sit under a logged row. */
function EntryDetail({ entry }: { entry: MasjidEntry }) {
  const parts: string[] = [];
  if (entry.status === "masjid" && entry.timing) {
    parts.push(TIMING_LABELS[entry.timing]);
    const rakah = describeRakah(entry.joinedRakah);
    if (rakah) parts.push(rakah);
  }
  if (entry.reason) parts.push(entry.reason);
  if (parts.length === 0) return null;

  return (
    <p className="mt-2 text-meta text-ink-3">
      <span className="text-ink-2">{parts.join(" · ")}</span>
    </p>
  );
}

/** What was kept of the voluntary rak'ahs, and a way in to change it. */
function SunnahLine({
  prayer,
  answers,
  onOpen,
}: {
  prayer: DailyPrayerKey;
  answers: PartAnswers;
  onOpen: () => void;
}) {
  if (!hasParts(prayer)) return null;

  const answered = Object.keys(answers).length;
  const summary = describeParts(prayer, answers);

  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
      <p className="text-meta text-ink-3">
        Sunnah
        {/* No tabular face here: the summary is mostly words, and the class
            would set "rak'ahs" in the numeric font alongside the digits. */}
        {summary ? <span className="text-ink-2"> · {summary}</span> : null}
        {!summary && answered > 0 ? (
          <span className="text-ink-2"> · none prayed</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="min-h-9 shrink-0 rounded-md border border-line px-3 text-meta font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-2"
      >
        {answered > 0 ? "Change" : "Log"}
      </button>
    </div>
  );
}
