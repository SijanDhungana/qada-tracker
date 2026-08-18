"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRAYER_LABELS, prayersFor, type PrayerKey } from "@/lib/prayers";
import { milestone, projectionSentence } from "@/lib/projection";
import type { MasjidEntry } from "@/lib/masjid";
import type { SunnahEntry } from "@/lib/sunnah";
import type { TahajjudEntry } from "@/lib/tahajjud";
import type { WitrEntry } from "@/lib/witr";
import type { WorshipCounts } from "@/lib/worship";
import { logPrayer, undoSlot, unlogLatest } from "@/lib/actions/log";
import { PrayerCounter } from "./PrayerCounter";
import { LedgerGrid, type GridDay } from "./LedgerGrid";
import { MasjidStrip } from "./MasjidStrip";
import { NightStrip } from "./NightStrip";
import { WorshipCard } from "./WorshipCard";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";
import { dayLabel } from "@/lib/prayers";

export type RecentLog = {
  dayId: string;
  dayIndex: number;
  dayDate: string | null;
  prayer: PrayerKey;
  loggedAt: string;
};

export type TodayData = {
  trackWitr: boolean;
  dailyGoal: number;
  totalSlots: number;
  completedSlots: number;
  totalDays: number;
  /** Outstanding slots per prayer. */
  outstandingByPrayer: Record<PrayerKey, number>;
  totalByPrayer: Record<PrayerKey, number>;
  gridDays: GridDay[];
  gridTruncated: boolean;
  targetDayId: string | null;
  recentLogs: RecentLog[];
  today: string;
  timezone: string;
  /** Midnight in the account's timezone, as an instant. */
  dayStartIso: string;
  masjidToday: MasjidEntry[];
  trackTahajjud: boolean;
  trackTahajjudRakahs: boolean;
  tahajjudToday: TahajjudEntry | null;
  witrToday: WitrEntry | null;
  trackSunnah: boolean;
  sunnahToday: SunnahEntry[];
  worshipToday: WorshipCounts;
  /** How many surahs were read today — the names live on /worship. */
  surahsToday: number;
};

export function TodayScreen({ data }: { data: TodayData }) {
  const router = useRouter();
  const toast = useToast();
  const prayers = useMemo(() => prayersFor(data.trackWitr), [data.trackWitr]);

  // Optimistic deltas layered over the server numbers, so a tap shows up
  // instantly and the server figures stay authoritative underneath.
  const [delta, setDelta] = useState<Record<string, number>>({});
  const [todayExtra, setTodayExtra] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [batchFor, setBatchFor] = useState<PrayerKey | null>(null);
  const [, startTransition] = useTransition();
  const announcement = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(0);

  /**
   * Once refreshed server data arrives it already contains the writes the
   * deltas were standing in for, so they must be dropped or every log counts
   * twice. Skipped while a write is still in flight — that request's own
   * refresh will clear them a moment later.
   */
  useEffect(() => {
    if (inFlight.current === 0) {
      setDelta({});
      setTodayExtra({});
    }
  }, [data]);

  // One boundary for the whole app: midnight in the account's timezone,
  // resolved on the server so both halves agree on what "today" means.
  const dayStart = data.dayStartIso;

  const loggedToday = useMemo(() => {
    const start = new Date(dayStart).getTime();
    const counts: Record<string, number> = {};
    for (const log of data.recentLogs) {
      if (new Date(log.loggedAt).getTime() >= start) {
        counts[log.prayer] = (counts[log.prayer] ?? 0) + 1;
      }
    }
    return counts;
  }, [data.recentLogs, dayStart]);

  function todayCount(prayer: PrayerKey) {
    return Math.max(0, (loggedToday[prayer] ?? 0) + (todayExtra[prayer] ?? 0));
  }

  function outstanding(prayer: PrayerKey) {
    return Math.max(0, data.outstandingByPrayer[prayer] - (delta[prayer] ?? 0));
  }

  const completed =
    data.completedSlots +
    prayers.reduce((sum, prayer) => sum + (delta[prayer] ?? 0), 0);
  const outstandingTotal = Math.max(0, data.totalSlots - completed);

  const goalToday = prayers.reduce((sum, prayer) => sum + todayCount(prayer), 0);
  const goalFraction = data.dailyGoal > 0 ? goalToday / data.dailyGoal : 0;
  const ahead = goalToday - data.dailyGoal;

  function announce(text: string) {
    if (announcement.current) announcement.current.textContent = text;
  }

  function log(prayer: PrayerKey, count = 1) {
    setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) + count }));
    setTodayExtra((t) => ({ ...t, [prayer]: (t[prayer] ?? 0) + count }));
    setBusy((b) => ({ ...b, [prayer]: true }));
    inFlight.current += 1;

    startTransition(async () => {
      const result = await logPrayer(prayer, count).catch(() => ({
        ok: false as const,
        error: "Couldn't save that. Check your connection.",
      }));

      setBusy((b) => ({ ...b, [prayer]: false }));
      inFlight.current -= 1;

      if (!result.ok) {
        setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) - count }));
        setTodayExtra((t) => ({ ...t, [prayer]: (t[prayer] ?? 0) - count }));
        toast({ message: result.error, tone: "danger" });
        return;
      }

      const slots = result.logged;
      // The server may have had fewer left than we optimistically assumed.
      const shortfall = count - slots.length;
      if (shortfall > 0) {
        setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) - shortfall }));
        setTodayExtra((t) => ({ ...t, [prayer]: (t[prayer] ?? 0) - shortfall }));
      }

      announce(
        `${PRAYER_LABELS[prayer]} logged. ${outstanding(prayer) - slots.length} ${
          PRAYER_LABELS[prayer]
        } outstanding.`,
      );

      toast({
        message:
          slots.length === 1
            ? `${PRAYER_LABELS[prayer]} logged · ${dayLabel(slots[0])}`
            : `${slots.length} ${PRAYER_LABELS[prayer]} logged`,
        coalesceKey: `log-${prayer}`,
        action: {
          label: "Undo",
          run: async () => {
            setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) - slots.length }));
            setTodayExtra((t) => ({
              ...t,
              [prayer]: (t[prayer] ?? 0) - slots.length,
            }));
            await Promise.all(slots.map((slot) => undoSlot(slot.dayId, prayer)));
            router.refresh();
          },
        },
      });

      router.refresh();
    });
  }

  function unlog(prayer: PrayerKey) {
    if (todayCount(prayer) <= 0) return;

    setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) - 1 }));
    setTodayExtra((t) => ({ ...t, [prayer]: (t[prayer] ?? 0) - 1 }));
    setBusy((b) => ({ ...b, [prayer]: true }));
    inFlight.current += 1;

    startTransition(async () => {
      const result = await unlogLatest(prayer, dayStart).catch(() => ({
        ok: false as const,
        error: "Couldn't save that. Check your connection.",
      }));

      setBusy((b) => ({ ...b, [prayer]: false }));
      inFlight.current -= 1;

      if (!result.ok) {
        setDelta((d) => ({ ...d, [prayer]: (d[prayer] ?? 0) + 1 }));
        setTodayExtra((t) => ({ ...t, [prayer]: (t[prayer] ?? 0) + 1 }));
        toast({ message: result.error, tone: "danger" });
        return;
      }

      announce(`${PRAYER_LABELS[prayer]} taken back.`);
      router.refresh();
    });
  }

  const projection = projectionSentence(outstandingTotal, data.dailyGoal, data.timezone);
  const nextMilestone = milestone(completed, outstandingTotal, data.dailyGoal);
  const allCleared = outstandingTotal <= 0 && data.totalSlots > 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <p ref={announcement} className="sr-only" aria-live="polite" role="status" />

      {/* 1. The count — completed leads, outstanding supports. */}
      <section aria-labelledby="count-heading">
        <h1 id="count-heading" className="sr-only">
          Your progress
        </h1>
        <p className="num display text-hero leading-none text-ink">
          {completed.toLocaleString()}
        </p>
        <p className="mt-2 text-body text-ink-2">
          logged of{" "}
          <span className="num">{data.totalSlots.toLocaleString()}</span> ·{" "}
          <span className="num">{outstandingTotal.toLocaleString()}</span> outstanding
        </p>
      </section>

      {allCleared ? (
        <section className="rounded-lg border border-done/40 bg-done-wash p-6">
          <h2 className="display text-section text-ink">
            Every day you tracked is cleared.
          </h2>
          <p className="mt-2 text-body text-ink-2">
            {data.totalSlots.toLocaleString()} prayers across{" "}
            {data.totalDays.toLocaleString()} days.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/settings"
              className="min-h-11 rounded-md bg-brand px-4 py-2.5 text-body font-semibold text-done-ink"
            >
              Add more days
            </Link>
            <a
              href="/api/export"
              className="min-h-11 rounded-md border border-line px-4 py-2.5 text-body font-medium text-ink-2 hover:bg-surface-2"
            >
              Export
            </a>
          </div>
        </section>
      ) : (
        <>
          {/* 2. Today's goal and the finish date it implies. */}
          <section aria-labelledby="goal-heading" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="goal-heading" className="text-body font-medium text-ink">
                <span className="num">{goalToday}</span> of{" "}
                <span className="num">{data.dailyGoal}</span> today
              </h2>
              {ahead > 0 ? (
                <span className="text-meta font-medium text-today">
                  {ahead} ahead
                </span>
              ) : null}
            </div>

            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={goalToday}
              aria-valuemin={0}
              aria-valuemax={data.dailyGoal}
              aria-label={`${goalToday} of ${data.dailyGoal} logged today`}
            >
              <span
                className="block h-full rounded-full bg-today transition-[width] duration-[var(--slow)] ease-[var(--ease)]"
                style={{ width: `${Math.min(100, Math.round(goalFraction * 100))}%` }}
              />
            </div>

            {projection ? (
              <p className="text-meta text-ink-3">{projection}</p>
            ) : (
              <p className="text-meta text-ink-3">
                <Link href="/settings" className="text-brand hover:underline">
                  Set a daily goal in Settings
                </Link>{" "}
                to see a finish date.
              </p>
            )}
          </section>

          {/* 3. The counters. */}
          <section aria-labelledby="log-heading" className="flex flex-col gap-3">
            <h2 id="log-heading" className="display text-section text-ink">
              Log a make-up prayer
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {prayers.map((prayer) => (
                <PrayerCounter
                  key={prayer}
                  prayer={prayer}
                  outstanding={outstanding(prayer)}
                  total={data.totalByPrayer[prayer]}
                  todayCount={todayCount(prayer)}
                  busy={Boolean(busy[prayer])}
                  onLog={() => log(prayer)}
                  onUnlog={() => unlog(prayer)}
                  onBatch={() => setBatchFor(prayer)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* 4. Today at the masjid. */}
      <MasjidStrip
        today={data.today}
        timezone={data.timezone}
        initialEntries={data.masjidToday}
        trackSunnah={data.trackSunnah}
        initialSunnah={data.sunnahToday}
      />

      {/* 5. Witr and Tahajjud, each shown only if it's being tracked. */}
      <NightStrip
        today={data.today}
        timezone={data.timezone}
        trackWitr={data.trackWitr}
        trackTahajjud={data.trackTahajjud}
        trackTahajjudRakahs={data.trackTahajjudRakahs}
        initialWitr={data.witrToday}
        initialTahajjud={data.tahajjudToday}
      />

      {/* 6. Everything voluntary, summarised. */}
      <WorshipCard counts={data.worshipToday} surahsRead={data.surahsToday} />

      {/* 7. The ledger grid. */}
      <section aria-labelledby="grid-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="grid-heading" className="display text-section text-ink">
            Your ledger
          </h2>
          <Link
            href="/ledger"
            className="shrink-0 rounded-sm text-meta font-medium text-brand hover:underline"
          >
            See full ledger →
          </Link>
        </div>

        <LedgerGrid
          days={data.gridDays}
          targetId={data.targetDayId}
          compact
          onSelect={(day) => router.push(`/ledger?focus=${day.id}`)}
        />

        <p className="text-meta text-ink-3">
          <span className="num">{data.totalDays.toLocaleString()}</span> days ·{" "}
          <span className="num">{outstandingTotal.toLocaleString()}</span>{" "}
          prayers outstanding
          {data.gridTruncated ? " · showing the earliest stretch" : ""}
        </p>
      </section>

      {nextMilestone ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-body text-ink-2">
          {nextMilestone}
        </p>
      ) : null}

      <BatchSheet
        prayer={batchFor}
        onClose={() => setBatchFor(null)}
        max={batchFor ? outstanding(batchFor) : 0}
        onSubmit={(count) => {
          if (batchFor) log(batchFor, count);
          setBatchFor(null);
        }}
      />
    </main>
  );
}

function BatchSheet({
  prayer,
  max,
  onClose,
  onSubmit,
}: {
  prayer: PrayerKey | null;
  max: number;
  onClose: () => void;
  onSubmit: (count: number) => void;
}) {
  const [count, setCount] = useState(5);
  const ceiling = Math.min(50, Math.max(1, max));
  const value = Math.min(count, ceiling);

  return (
    <Sheet
      open={prayer !== null}
      onClose={onClose}
      title={prayer ? `Log more than one ${PRAYER_LABELS[prayer]}` : ""}
      description="For catching up in batches. These are taken from the oldest first."
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            aria-label="One fewer"
            className="grid size-12 place-items-center rounded-md border border-line text-name text-ink-2 hover:bg-surface-2"
          >
            −
          </button>
          <span className="num min-w-16 text-center text-counter text-ink">{value}</span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(ceiling, c + 1))}
            aria-label="One more"
            className="grid size-12 place-items-center rounded-md border border-line text-name text-ink-2 hover:bg-surface-2"
          >
            +
          </button>
        </div>

        <p className="text-center text-meta text-ink-3">
          {ceiling < 50 ? `${ceiling} left to log.` : "Up to 50 at a time."}
        </p>

        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink"
        >
          Log {value}
        </button>
      </div>
    </Sheet>
  );
}
