"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BASE_PRAYERS, PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  STATUS_SHORT,
  TIMING_LABELS,
  describeRakah,
  hardestPrayer,
  summarise,
  topReasons,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import {
  DEFAULT_TAHAJJUD_RAKAHS,
  MAX_TAHAJJUD_RAKAHS,
  TAHAJJUD_RAKAH_STEP,
  TAHAJJUD_SHORT,
  TAHAJJUD_STATUSES,
  summariseTahajjud,
  type TahajjudEntry,
  type TahajjudStatus,
} from "@/lib/tahajjud";
import {
  DEFAULT_DUHA_RAKAHS,
  DUHA_LABELS,
  DUHA_RAKAH_STEP,
  DUHA_STATUSES,
  MAX_DUHA_RAKAHS,
  summariseDuha,
  type DuhaEntry,
  type DuhaStatus,
} from "@/lib/duha";
import {
  describeParts,
  hasParts,
  partsFor,
  summariseSunnah,
  type PartAnswers,
  type SunnahEntry,
} from "@/lib/sunnah";
import {
  WITR_LABELS,
  WITR_STATUSES,
  summariseWitr,
  type WitrEntry,
  type WitrStatus,
} from "@/lib/witr";
import { formatDateKey, shiftDateKey } from "@/lib/time";
import { clearMasjidPrayer, recordMasjidPrayer } from "@/lib/actions/masjid";
import { clearTahajjud, recordTahajjud } from "@/lib/actions/tahajjud";
import { clearSunnah, saveSunnahParts } from "@/lib/actions/sunnah";
import { clearWitr, recordWitr } from "@/lib/actions/witr";
import { clearDuha, recordDuha } from "@/lib/actions/duha";
import { PrayerSheet, type SheetSave, type SheetTarget } from "./PrayerSheet";
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

function partKey(entry: { prayerDate: string; prayer: string; part: string }) {
  return `${entry.prayerDate}:${entry.prayer}:${entry.part}`;
}

const TAHAJJUD_DOT: Record<TahajjudStatus, string> = {
  prayed: "bg-done text-done-ink",
  woke: "bg-done-2 text-done-ink",
  slept: "bg-surface-3 text-ink-2",
};

export function MasjidHistory({
  entries: initialEntries,
  tahajjud: initialTahajjud,
  witr: initialWitr,
  sunnah: initialSunnah,
  duha: initialDuha,
  trackTahajjud,
  trackTahajjudRakahs,
  trackWitr,
  trackSunnah,
  trackDuha,
  today,
}: {
  entries: MasjidEntry[];
  tahajjud: TahajjudEntry[];
  witr: WitrEntry[];
  sunnah: SunnahEntry[];
  duha: DuhaEntry[];
  trackTahajjud: boolean;
  trackTahajjudRakahs: boolean;
  trackWitr: boolean;
  trackSunnah: boolean;
  trackDuha: boolean;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [range, setRange] = useState<Range>("30");
  const [entries, setEntries] = useState<Record<string, MasjidEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [keyOf(entry), entry])),
  );
  const [nights, setNights] = useState<Record<string, TahajjudEntry>>(() =>
    Object.fromEntries(initialTahajjud.map((entry) => [entry.prayerDate, entry])),
  );
  const [witrDays, setWitrDays] = useState<Record<string, WitrEntry>>(() =>
    Object.fromEntries(initialWitr.map((entry) => [entry.prayerDate, entry])),
  );
  // Keyed "date:prayer:part" so one prayer's parts stay independent.
  const [sunnahDays, setSunnahDays] = useState<Record<string, SunnahEntry>>(() =>
    Object.fromEntries(initialSunnah.map((entry) => [partKey(entry), entry])),
  );
  const [duhaDays, setDuhaDays] = useState<Record<string, DuhaEntry>>(() =>
    Object.fromEntries(initialDuha.map((entry) => [entry.prayerDate, entry])),
  );
  const [target, setTarget] = useState<SheetTarget | null>(null);
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

  function save(dateKey: string, prayer: DailyPrayerKey, value: SheetSave) {
    const id = `${dateKey}:${prayer}`;
    const previous = entries[id];
    const previousParts = partAnswers(dateKey, prayer);

    const optimistic: MasjidEntry | null = value.masjid
      ? {
          prayerDate: dateKey,
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
      if (optimistic) next[id] = optimistic;
      else delete next[id];
      return next;
    });
    applyParts(dateKey, prayer, value.parts);

    function rollback() {
      setEntries((current) => {
        const next = { ...current };
        if (previous) next[id] = previous;
        else delete next[id];
        return next;
      });
      applyParts(dateKey, prayer, previousParts);
    }

    startTransition(async () => {
      const writes: Promise<{ ok: boolean; error?: string }>[] = [];

      if (value.masjid) {
        writes.push(
          recordMasjidPrayer({
            prayerDate: dateKey,
            prayer,
            status: value.masjid.status,
            timing: value.masjid.timing,
            joinedRakah: value.masjid.joinedRakah,
            reason: value.masjid.reason,
          }),
        );
      } else if (previous) {
        writes.push(clearMasjidPrayer(dateKey, prayer));
      }

      if (trackSunnah && hasParts(prayer)) {
        writes.push(saveSunnahParts(dateKey, prayer, value.parts));
      }

      const results = await Promise.all(
        writes.map((write) =>
          write.catch(() => ({ ok: false, error: "Couldn't save that." })),
        ),
      );

      const failure = results.find((result) => !result.ok);
      if (failure) {
        rollback();
        toast({ message: failure.error ?? "Couldn't save that.", tone: "danger" });
        return;
      }

      toast({
        message: `${PRAYER_LABELS[prayer]} on ${formatDateKey(dateKey, false)} saved`,
        coalesceKey: "prayer",
        action: {
          label: "Undo",
          run: async () => {
            rollback();
            if (previous) {
              await recordMasjidPrayer({
                prayerDate: dateKey,
                prayer,
                status: previous.status,
                timing: previous.timing,
                joinedRakah: previous.joinedRakah,
                reason: previous.reason,
              });
            } else {
              await clearMasjidPrayer(dateKey, prayer);
            }
            if (trackSunnah && hasParts(prayer)) {
              await saveSunnahParts(dateKey, prayer, previousParts);
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
    applyParts(dateKey, prayer, {});
    setTarget(null);
    void clearSunnah(dateKey, prayer);

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

  /** Writes one night, or clears it when `entry` is null. */
  function writeNight(dateKey: string, entry: TahajjudEntry | null) {
    const previous = nights[dateKey];

    setNights((current) => {
      const next = { ...current };
      if (entry) next[dateKey] = entry;
      else delete next[dateKey];
      return next;
    });

    startTransition(async () => {
      const result = await (entry
        ? recordTahajjud(dateKey, entry.status, entry.rakahs)
        : clearTahajjud(dateKey)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setNights((current) => {
          const next = { ...current };
          if (previous) next[dateKey] = previous;
          else delete next[dateKey];
          return next;
        });
        toast({ message: result.error, tone: "danger" });
        return;
      }
      router.refresh();
    });
  }

  function saveNight(dateKey: string, status: TahajjudStatus) {
    const previous = nights[dateKey];
    if (previous?.status === status) {
      writeNight(dateKey, null);
      return;
    }
    writeNight(dateKey, {
      prayerDate: dateKey,
      status,
      rakahs:
        trackTahajjudRakahs && status === "prayed"
          ? (previous?.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS)
          : null,
      loggedAt: new Date().toISOString(),
    });
  }

  function stepNightRakahs(dateKey: string, direction: 1 | -1) {
    const entry = nights[dateKey];
    if (!entry || entry.status !== "prayed") return;
    const current = entry.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS;
    const next = Math.min(
      MAX_TAHAJJUD_RAKAHS,
      Math.max(TAHAJJUD_RAKAH_STEP, current + direction * TAHAJJUD_RAKAH_STEP),
    );
    if (next === current) return;
    writeNight(dateKey, { ...entry, rakahs: next });
  }

  /** Writes one night's witr, or clears it when `entry` is null. */
  function writeWitr(dateKey: string, entry: WitrEntry | null) {
    const previous = witrDays[dateKey];

    setWitrDays((current) => {
      const next = { ...current };
      if (entry) next[dateKey] = entry;
      else delete next[dateKey];
      return next;
    });

    startTransition(async () => {
      const result = await (entry
        ? recordWitr(dateKey, entry.status, entry.remade)
        : clearWitr(dateKey)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setWitrDays((current) => {
          const next = { ...current };
          if (previous) next[dateKey] = previous;
          else delete next[dateKey];
          return next;
        });
        toast({ message: result.error, tone: "danger" });
        return;
      }
      router.refresh();
    });
  }

  function saveWitrDay(dateKey: string, status: WitrStatus) {
    const previous = witrDays[dateKey];
    if (previous?.status === status) {
      writeWitr(dateKey, null);
      return;
    }
    writeWitr(dateKey, {
      prayerDate: dateKey,
      status,
      remade: false,
      loggedAt: new Date().toISOString(),
    });
  }

  /** What is currently recorded for one prayer's voluntary rak'ahs. */
  function partAnswers(dateKey: string, prayer: DailyPrayerKey): PartAnswers {
    const answers: PartAnswers = {};
    for (const spec of partsFor(prayer)) {
      const row = sunnahDays[`${dateKey}:${prayer}:${spec.part}`];
      if (row) answers[spec.part] = row.prayed;
    }
    return answers;
  }

  /** Mirrors a saved set of answers into local state, dropping the blanks. */
  function applyParts(
    dateKey: string,
    prayer: DailyPrayerKey,
    answers: PartAnswers,
  ) {
    setSunnahDays((current) => {
      const updated = { ...current };
      for (const spec of partsFor(prayer)) {
        const id = `${dateKey}:${prayer}:${spec.part}`;
        const value = answers[spec.part];
        if (typeof value === "boolean") {
          updated[id] = {
            prayerDate: dateKey,
            prayer,
            part: spec.part,
            prayed: value,
            loggedAt: new Date().toISOString(),
          };
        } else {
          delete updated[id];
        }
      }
      return updated;
    });
  }

  const scopedNights = useMemo(
    () => Object.values(nights).filter((night) => night.prayerDate >= cutoff),
    [nights, cutoff],
  );

  /** Writes one day's duha, or clears it when `entry` is null. */
  function writeDuha(dateKey: string, entry: DuhaEntry | null) {
    const previous = duhaDays[dateKey];

    setDuhaDays((current) => {
      const next = { ...current };
      if (entry) next[dateKey] = entry;
      else delete next[dateKey];
      return next;
    });

    startTransition(async () => {
      const result = await (entry
        ? recordDuha(dateKey, entry.status, entry.rakahs)
        : clearDuha(dateKey)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setDuhaDays((current) => {
          const next = { ...current };
          if (previous) next[dateKey] = previous;
          else delete next[dateKey];
          return next;
        });
        toast({ message: result.error, tone: "danger" });
        return;
      }
      router.refresh();
    });
  }

  function saveDuhaDay(dateKey: string, status: DuhaStatus) {
    const previous = duhaDays[dateKey];
    if (previous?.status === status) {
      writeDuha(dateKey, null);
      return;
    }
    writeDuha(dateKey, {
      prayerDate: dateKey,
      status,
      rakahs:
        status === "prayed" ? (previous?.rakahs ?? DEFAULT_DUHA_RAKAHS) : null,
      loggedAt: new Date().toISOString(),
    });
  }

  function stepDuhaRakahs(dateKey: string, direction: 1 | -1) {
    const entry = duhaDays[dateKey];
    if (!entry || entry.status !== "prayed") return;
    const current = entry.rakahs ?? DEFAULT_DUHA_RAKAHS;
    const next = Math.min(
      MAX_DUHA_RAKAHS,
      Math.max(DUHA_RAKAH_STEP, current + direction * DUHA_RAKAH_STEP),
    );
    if (next === current) return;
    writeDuha(dateKey, { ...entry, rakahs: next });
  }

  const scopedDuha = useMemo(
    () => Object.values(duhaDays).filter((entry) => entry.prayerDate >= cutoff),
    [duhaDays, cutoff],
  );

  const scopedWitr = useMemo(
    () => Object.values(witrDays).filter((entry) => entry.prayerDate >= cutoff),
    [witrDays, cutoff],
  );

  const scopedSunnah = useMemo(
    () => Object.values(sunnahDays).filter((entry) => entry.prayerDate >= cutoff),
    [sunnahDays, cutoff],
  );

  const summary = summarise(scoped);
  const nightSummary = summariseTahajjud(scopedNights);
  const witrSummary = summariseWitr(scopedWitr);
  const duhaSummary = summariseDuha(scopedDuha);
  const sunnahSummary = summariseSunnah(scopedSunnah);
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
              <h2 className="text-body font-medium text-ink">Caught from the start</h2>
              {summary.onTime + summary.late > 0 ? (
                <>
                  <p className="num mt-2 text-counter leading-none text-done">
                    {Math.round(
                      (summary.onTime / (summary.onTime + summary.late)) * 100,
                    )}
                    %
                  </p>
                  <p className="mt-1 text-meta text-ink-3">
                    <span className="num">{summary.onTime}</span> on time ·{" "}
                    <span className="num">{summary.late}</span> late
                  </p>
                </>
              ) : (
                <p className="mt-2 text-meta text-ink-3">
                  No masjid prayers logged with a timing yet.
                </p>
              )}
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
      ) : null}

      {/*
        Outside the masjid block on purpose: someone who tracks only witr or
        sunnah still has something worth summarising, and gating these on
        masjid entries would leave their screen permanently empty.
      */}
      {nightSummary.logged +
        witrSummary.logged +
        sunnahSummary.logged +
        duhaSummary.logged >
      0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {trackTahajjud && nightSummary.logged > 0 ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">Tahajjud</h2>
              <p className="num mt-2 text-counter leading-none text-ink">
                {nightSummary.prayed}
              </p>
              <p className="mt-1 text-meta text-ink-3">
                {nightSummary.prayed === 1 ? "night" : "nights"} prayed, of{" "}
                <span className="num">{nightSummary.logged}</span> logged ·{" "}
                <span className="num">{nightSummary.woke}</span> woke without praying
              </p>
              {trackTahajjudRakahs && nightSummary.rakahs > 0 ? (
                <p className="mt-1 text-meta text-ink-3">
                  <span className="num text-ink-2">{nightSummary.rakahs}</span>{" "}
                  rak&apos;ahs in all
                </p>
              ) : null}
            </section>
          ) : null}

          {trackDuha && duhaSummary.logged > 0 ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">Duha</h2>
              <p className="num mt-2 text-counter leading-none text-ink">
                {duhaSummary.prayed}
              </p>
              <p className="mt-1 text-meta text-ink-3">
                {duhaSummary.prayed === 1 ? "day" : "days"} prayed, of{" "}
                <span className="num">{duhaSummary.logged}</span> logged
                {duhaSummary.rakahs > 0 ? (
                  <>
                    {" · "}
                    <span className="num">{duhaSummary.rakahs}</span> rak&apos;ahs in
                    all
                  </>
                ) : null}
              </p>
            </section>
          ) : null}

          {trackWitr && witrSummary.logged > 0 ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">Witr</h2>
              <p className="num mt-2 text-counter leading-none text-ink">
                {witrSummary.prayed}
              </p>
              <p className="mt-1 text-meta text-ink-3">
                {witrSummary.prayed === 1 ? "night" : "nights"} prayed, of{" "}
                <span className="num">{witrSummary.logged}</span> logged
                {witrSummary.remade > 0 ? (
                  <>
                    {" · "}
                    <span className="num">{witrSummary.remade}</span> made up later
                  </>
                ) : null}
              </p>
            </section>
          ) : null}

          {trackSunnah && sunnahSummary.logged > 0 ? (
            <section className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-body font-medium text-ink">Sunnah prayers</h2>
              <p className="num mt-2 text-counter leading-none text-done">
                {Math.round((sunnahSummary.prayed / sunnahSummary.logged) * 100)}%
              </p>
              <p className="mt-1 text-meta text-ink-3">
                <span className="num">{sunnahSummary.prayed}</span> prayed of{" "}
                <span className="num">{sunnahSummary.logged}</span> answered
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      {summary.logged +
        nightSummary.logged +
        witrSummary.logged +
        sunnahSummary.logged +
        duhaSummary.logged ===
      0 ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-body text-ink-3">
          Nothing logged in this stretch yet. Tap any prayer below to fill it in.
        </p>
      ) : null}

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
            const details = dayEntries
              .map((entry) => {
                const parts: string[] = [];
                if (entry.status === "masjid" && entry.timing) {
                  parts.push(TIMING_LABELS[entry.timing]);
                  const rakah = describeRakah(entry.joinedRakah);
                  if (rakah) parts.push(rakah);
                }
                if (entry.reason) parts.push(entry.reason);
                return { prayer: entry.prayer, text: parts.join(" · ") };
              })
              .filter((detail) => detail.text.length > 0);

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
                              timing: entry?.timing ?? null,
                              joinedRakah: entry?.joinedRakah ?? null,
                              reason: entry?.reason ?? null,
                              parts: partAnswers(dateKey, prayer),
                              showParts: trackSunnah,
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

                {details.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {details.map((detail) => (
                      <li key={detail.prayer} className="text-meta text-ink-3">
                        {PRAYER_LABELS[detail.prayer]} ·{" "}
                        <span className="text-ink-2">{detail.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {trackSunnah ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-meta text-ink-3">
                      Sunnah
                      {(() => {
                        // The rak'ahs kept across the whole day, in one number.
                        const rakahs = BASE_PRAYERS.reduce((sum, prayer) => {
                          const answers = partAnswers(dateKey, prayer);
                          return (
                            sum +
                            partsFor(prayer)
                              .filter((spec) => answers[spec.part] === true)
                              .reduce((inner, spec) => inner + spec.rakahs, 0)
                          );
                        }, 0);
                        return rakahs > 0 ? (
                          <span className="num text-ink-2"> · {rakahs} rak&apos;ahs</span>
                        ) : null;
                      })()}
                    </p>
                    <div
                      role="group"
                      aria-label={`Sunnah on ${formatDateKey(dateKey, false)}`}
                      className="flex gap-1.5"
                    >
                      {BASE_PRAYERS.filter(hasParts).map((prayer) => {
                        const answers = partAnswers(dateKey, prayer);
                        const specs = partsFor(prayer);
                        const answered = specs.filter(
                          (spec) => answers[spec.part] !== undefined,
                        ).length;
                        const prayed = specs.filter(
                          (spec) => answers[spec.part] === true,
                        ).length;
                        const summary = describeParts(prayer, answers);

                        return (
                          <button
                            key={prayer}
                            type="button"
                            onClick={() =>
                              setTarget({
                                dateKey,
                                prayer,
                                status: entries[`${dateKey}:${prayer}`]?.status,
                                timing:
                                  entries[`${dateKey}:${prayer}`]?.timing ?? null,
                                joinedRakah:
                                  entries[`${dateKey}:${prayer}`]?.joinedRakah ?? null,
                                reason:
                                  entries[`${dateKey}:${prayer}`]?.reason ?? null,
                                parts: answers,
                                showParts: true,
                              })
                            }
                            aria-label={`${PRAYER_LABELS[prayer]} sunnah on ${formatDateKey(dateKey, false)}: ${
                              answered === 0 ? "not logged" : (summary ?? "none prayed")
                            }. Tap to change.`}
                            className={`grid size-9 place-items-center rounded-md text-meta font-medium transition-colors ${
                              prayed === specs.length
                                ? "bg-done text-done-ink"
                                : prayed > 0
                                  ? "bg-done-2 text-done-ink"
                                  : answered > 0
                                    ? "bg-surface-3 text-ink-2"
                                    : "border border-dashed border-line-strong text-ink-3 hover:bg-surface-2"
                            }`}
                          >
                            {PRAYER_LABELS[prayer].slice(0, 1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {trackDuha ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-meta text-ink-3">
                      Duha
                      {duhaDays[dateKey]?.status === "prayed" ? (
                        <span className="num text-ink-2">
                          {" · "}
                          {duhaDays[dateKey].rakahs ?? DEFAULT_DUHA_RAKAHS}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {duhaDays[dateKey]?.status === "prayed" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => stepDuhaRakahs(dateKey, -1)}
                            aria-label={`Fewer rak'ahs of duha on ${formatDateKey(dateKey, false)}`}
                            className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => stepDuhaRakahs(dateKey, 1)}
                            aria-label={`More rak'ahs of duha on ${formatDateKey(dateKey, false)}`}
                            className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2"
                          >
                            +
                          </button>
                        </>
                      ) : null}
                      <div
                        role="group"
                        aria-label={`Duha on ${formatDateKey(dateKey, false)}`}
                        className="flex gap-1.5"
                      >
                        {DUHA_STATUSES.map((status) => {
                          const selected = duhaDays[dateKey]?.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => saveDuhaDay(dateKey, status)}
                              className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                                selected
                                  ? status === "prayed"
                                    ? "border-transparent bg-done text-done-ink"
                                    : "border-transparent bg-surface-3 text-ink-2"
                                  : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                              }`}
                            >
                              {DUHA_LABELS[status]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {trackWitr ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-meta text-ink-3">
                      Witr
                      {witrDays[dateKey]?.status === "missed" ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() =>
                              writeWitr(dateKey, {
                                ...witrDays[dateKey],
                                remade: !witrDays[dateKey].remade,
                              })
                            }
                            className={
                              witrDays[dateKey].remade
                                ? "text-done underline"
                                : "text-brand underline"
                            }
                          >
                            {witrDays[dateKey].remade ? "made up" : "mark made up"}
                          </button>
                        </>
                      ) : null}
                    </p>
                    <div
                      role="group"
                      aria-label={`Witr on ${formatDateKey(dateKey, false)}`}
                      className="flex gap-1.5"
                    >
                      {WITR_STATUSES.map((status) => {
                        const selected = witrDays[dateKey]?.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => saveWitrDay(dateKey, status)}
                            className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                              selected
                                ? status === "prayed"
                                  ? "border-transparent bg-done text-done-ink"
                                  : "border-transparent bg-surface-3 text-ink-2"
                                : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                            }`}
                          >
                            {WITR_LABELS[status]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {trackTahajjud ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-meta text-ink-3">Tahajjud</p>
                    <div
                      role="group"
                      aria-label={`Tahajjud on ${formatDateKey(dateKey, false)}`}
                      className="flex gap-1.5"
                    >
                      {TAHAJJUD_STATUSES.map((status) => {
                        const selected = nights[dateKey]?.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => saveNight(dateKey, status)}
                            className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                              selected
                                ? `${TAHAJJUD_DOT[status]} border-transparent`
                                : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                            }`}
                          >
                            {TAHAJJUD_SHORT[status]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {trackTahajjud &&
                trackTahajjudRakahs &&
                nights[dateKey]?.status === "prayed" ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-meta text-ink-3">Rak&apos;ahs</p>
                    <div
                      role="group"
                      aria-label={`Rak'ahs of tahajjud on ${formatDateKey(dateKey, false)}`}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => stepNightRakahs(dateKey, -1)}
                        aria-label="Fewer rak'ahs"
                        className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2"
                      >
                        −
                      </button>
                      <span className="num w-8 text-center text-meta text-ink">
                        {nights[dateKey]?.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS}
                      </span>
                      <button
                        type="button"
                        onClick={() => stepNightRakahs(dateKey, 1)}
                        aria-label="More rak'ahs"
                        className="grid size-9 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <PrayerSheet
        target={target}
        onClose={() => setTarget(null)}
        onSave={(value) => {
          if (target) save(target.dateKey, target.prayer, value);
          setTarget(null);
        }}
        onClear={() => {
          if (target) clear(target.dateKey, target.prayer);
        }}
      />
    </main>
  );
}
