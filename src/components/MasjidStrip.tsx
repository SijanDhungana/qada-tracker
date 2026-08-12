"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BASE_PRAYERS, PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  MAX_REASON_LENGTH,
  REASON_SUGGESTIONS,
  STATUS_LABELS,
  STATUS_SHORT,
  formatTime,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import { clearMasjidPrayer, recordMasjidPrayer } from "@/lib/actions/masjid";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";

type Draft = { prayer: DailyPrayerKey; status: MasjidStatus };

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
  initialEntries,
}: {
  today: string;
  initialEntries: MasjidEntry[];
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<Record<string, MasjidEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.prayer, entry])),
  );
  const [draft, setDraft] = useState<Draft | null>(null);
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
    // Anything other than the masjid gets the chance to note why.
    if (status === "masjid") save(prayer, "masjid", null);
    else setDraft({ prayer, status });
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
          : `${masjidCount} of ${loggedCount} logged at the masjid so far today.`}
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
                      {formatTime(entry.loggedAt)}
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

      <ReasonSheet
        draft={draft}
        onClose={() => setDraft(null)}
        onSubmit={(reason) => {
          if (draft) save(draft.prayer, draft.status, reason);
          setDraft(null);
        }}
      />
    </section>
  );
}

function ReasonSheet({
  draft,
  onClose,
  onSubmit,
}: {
  draft: Draft | null;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Sheet
      open={draft !== null}
      onClose={() => {
        setReason("");
        onClose();
      }}
      title={
        draft
          ? `${PRAYER_LABELS[draft.prayer]} — ${STATUS_LABELS[draft.status].toLowerCase()}`
          : ""
      }
      description="Add a note if it helps you spot a pattern. You can skip this."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {REASON_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setReason(suggestion)}
              aria-pressed={reason === suggestion}
              className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                reason === suggestion
                  ? "border-brand bg-brand-wash text-brand"
                  : "border-line bg-surface-2 text-ink-2 hover:text-ink"
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="masjid-reason" className="mb-1.5 block text-meta text-ink-2">
            Or write your own
          </label>
          <input
            id="masjid-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REASON_LENGTH}
            placeholder="Optional"
            className="min-h-11 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink
                       outline-none placeholder:text-ink-3 focus:border-brand"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onSubmit(null);
              setReason("");
            }}
            className="min-h-12 flex-1 rounded-md border border-line text-body font-medium text-ink-2 hover:bg-surface-2"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => {
              onSubmit(reason.trim() || null);
              setReason("");
            }}
            className="min-h-12 flex-1 rounded-md bg-brand text-body font-semibold text-done-ink"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
