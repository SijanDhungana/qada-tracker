"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BASE_PRAYERS, PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  STATUS_SHORT,
  hardestPrayer,
  summarise,
  topReasons,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import { formatDateKey, shiftDateKey } from "@/lib/time";
import { clearMasjidPrayer, recordMasjidPrayer } from "@/lib/actions/masjid";
import { MasjidEditorSheet, type EditorTarget } from "./MasjidEditorSheet";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useToast } from "./ui/Toast";

const DOT: Record<MasjidStatus, string> = {
  masjid: "bg-done text-done-ink",
  alone: "bg-done-2 text-done-ink",
  missed: "bg-surface-3 text-ink-2",
};

type Range = "7" | "30" | "90";

function keyOf(entry: { prayerDate: string; prayer: string }) {
  return `${entry.prayerDate}:${entry.prayer}`;
}

export function MasjidHistory({
  entries: initialEntries,
  today,
}: {
  entries: MasjidEntry[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [range, setRange] = useState<Range>("30");
  const [entries, setEntries] = useState<Record<string, MasjidEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [keyOf(entry), entry])),
  );
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [, startTransition] = useTransition();

  const cutoff = useMemo(() => shiftDateKey(today, -Number(range) + 1), [today, range]);

  const scoped = useMemo(
    () => Object.values(entries).filter((entry) => entry.prayerDate >= cutoff),
    [entries, cutoff],
  );

  /**
   * Every day in the window gets a row, not just the ones already logged —
   * otherwise there is nothing to tap on the day you forgot to record.
   */
  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < Number(range); i++) list.push(shiftDateKey(today, -i));
    return list;
  }, [today, range]);

  function save(
    dateKey: string,
    prayer: DailyPrayerKey,
    status: MasjidStatus,
    reason: string | null,
  ) {
    const id = `${dateKey}:${prayer}`;
    const previous = entries[id];
    const optimistic: MasjidEntry = {
      prayerDate: dateKey,
      prayer,
      status,
      reason,
      loggedAt: new Date().toISOString(),
    };
    setEntries((current) => ({ ...current, [id]: optimistic }));

    startTransition(async () => {
      const result = await recordMasjidPrayer({
        prayerDate: dateKey,
        prayer,
        status,
        reason,
      }).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntries((current) => {
          const next = { ...current };
          if (previous) next[id] = previous;
          else delete next[id];
          return next;
        });
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message: `${PRAYER_LABELS[prayer]} on ${formatDateKey(dateKey, false)} · ${STATUS_SHORT[status].toLowerCase()}`,
        action: {
          label: "Undo",
          run: async () => {
            setEntries((current) => {
              const next = { ...current };
              if (previous) next[id] = previous;
              else delete next[id];
              return next;
            });
            if (previous) {
              await recordMasjidPrayer({
                prayerDate: dateKey,
                prayer,
                status: previous.status,
                reason: previous.reason,
              });
            } else {
              await clearMasjidPrayer(dateKey, prayer);
            }
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  function clear(dateKey: string, prayer: DailyPrayerKey) {
    const id = `${dateKey}:${prayer}`;
    const previous = entries[id];
    setEntries((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setTarget(null);

    startTransition(async () => {
      const result = await clearMasjidPrayer(dateKey, prayer).catch(() => ({
        ok: false as const,
        error: "Couldn't remove that.",
      }));
      if (!result.ok) {
        if (previous) setEntries((current) => ({ ...current, [id]: previous }));
        toast({ message: result.error, tone: "danger" });
        return;
      }
      toast({ message: `${PRAYER_LABELS[prayer]} cleared` });
      router.refresh();
    });
  }

  const summary = summarise(scoped);
  const reasons = topReasons(scoped);
  const hardest = hardestPrayer(scoped);
  const masjidShare =
    summary.logged > 0 ? Math.round((summary.masjid / summary.logged) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="display text-title text-ink">At the masjid</h1>
          <Link
            href="/"
            className="shrink-0 rounded-sm text-meta font-medium text-brand hover:underline"
          >
            ← Today
          </Link>
        </div>

        <SegmentedControl
          label="Time range"
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </header>

      {summary.logged > 0 ? (
        <>
          <section className="rounded-lg border border-line bg-surface p-5">
            <p className="num display text-counter leading-none text-ink">
              {summary.masjid}
            </p>
            <p className="mt-2 text-body text-ink-2">
              prayers at the masjid, of{" "}
              <span className="num">{summary.logged}</span> logged
            </p>

            <div
              className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={`${summary.masjid} at the masjid, ${summary.alone} on your own, ${summary.missed} missed`}
            >
              {(
                [
                  ["masjid", summary.masjid],
                  ["alone", summary.alone],
                  ["missed", summary.missed],
                ] as const
              ).map(([status, value]) =>
                value > 0 ? (
                  <span
                    key={status}
                    className={DOT[status]}
                    style={{ width: `${(value / summary.logged) * 100}%` }}
                  />
                ) : null,
              )}
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {(
                [
                  ["masjid", summary.masjid],
                  ["alone", summary.alone],
                  ["missed", summary.missed],
                ] as const
              ).map(([status, value]) => (
                <li
                  key={status}
                  className="flex items-center gap-1.5 text-meta text-ink-3"
                >
                  <span className={`size-2.5 rounded-full ${DOT[status]}`} />
                  {STATUS_SHORT[status]} <span className="num text-ink-2">{value}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">In congregation</h2>
              <p className="num mt-2 text-counter leading-none text-done">
                {masjidShare}%
              </p>
              <p className="mt-1 text-meta text-ink-3">of the prayers you logged</p>
            </section>

            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">Hardest to make</h2>
              {hardest ? (
                <>
                  <p className="mt-2 text-counter leading-none text-ink">
                    {PRAYER_LABELS[hardest.prayer]}
                  </p>
                  <p className="mt-1 text-meta text-ink-3">
                    away from the masjid{" "}
                    <span className="num">{hardest.away}</span> of{" "}
                    <span className="num">{hardest.total}</span> times
                  </p>
                </>
              ) : (
                <p className="mt-2 text-meta text-ink-3">
                  Every prayer you logged was at the masjid.
                </p>
              )}
            </section>
          </div>

          {reasons.length > 0 ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">What got in the way</h2>
              <p className="mt-1 text-meta text-ink-3">
                The notes you added most often.
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {reasons.map((item) => (
                  <li key={item.reason} className="flex items-center gap-3">
                    <span className="min-w-24 text-body text-ink-2">{item.reason}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full bg-done-2"
                        style={{ width: `${(item.count / reasons[0].count) * 100}%` }}
                      />
                    </span>
                    <span className="num w-6 text-right text-meta text-ink-3">
                      {item.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-body text-ink-3">
          Nothing logged in this stretch yet. Tap any prayer below to fill it in.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="display text-section text-ink">Day by day</h2>
        <p className="text-meta text-ink-3">
          Tap any prayer to set or correct it — including days you missed at the
          time.
        </p>

        <ul className="mt-1 flex flex-col gap-2">
          {days.map((dateKey) => {
            const dayEntries = BASE_PRAYERS.map(
              (prayer) => entries[`${dateKey}:${prayer}`],
            ).filter(Boolean);
            const notes = dayEntries.filter(
              (entry) => entry.status !== "masjid" && entry.reason,
            );

            return (
              <li
                key={dateKey}
                className="rounded-md border border-line bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="num text-body text-ink">
                    {dateKey === today ? "Today" : formatDateKey(dateKey)}
                  </p>

                  <div className="flex gap-1.5">
                    {BASE_PRAYERS.map((prayer) => {
                      const entry = entries[`${dateKey}:${prayer}`];
                      return (
                        <button
                          key={prayer}
                          type="button"
                          onClick={() =>
                            setTarget({
                              dateKey,
                              prayer,
                              status: entry?.status,
                              reason: entry?.reason ?? null,
                              askStatus: true,
                            })
                          }
                          aria-label={
                            entry
                              ? `${PRAYER_LABELS[prayer]} on ${formatDateKey(dateKey, false)}: ${STATUS_SHORT[entry.status]}. Change it.`
                              : `${PRAYER_LABELS[prayer]} on ${formatDateKey(dateKey, false)}: not logged. Add it.`
                          }
                          className={`grid size-11 place-items-center rounded-md text-meta font-medium transition-colors ${
                            entry
                              ? DOT[entry.status]
                              : "border border-dashed border-line-strong text-ink-3 hover:bg-surface-2"
                          }`}
                        >
                          {PRAYER_LABELS[prayer].slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {notes.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {notes.map((note) => (
                      <li key={note.prayer} className="text-meta text-ink-3">
                        {PRAYER_LABELS[note.prayer]} ·{" "}
                        <span className="text-ink-2">{note.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <MasjidEditorSheet
        target={target}
        onClose={() => setTarget(null)}
        onSave={(status, reason) => {
          if (target) save(target.dateKey, target.prayer, status, reason);
          setTarget(null);
        }}
        onClear={() => {
          if (target) clear(target.dateKey, target.prayer);
        }}
      />
    </main>
  );
}
