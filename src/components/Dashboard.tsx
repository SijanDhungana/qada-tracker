"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { markDayDone, setPrayer, type ActionResult } from "@/lib/actions/days";
import { prayersFor, type PrayerKey } from "@/lib/prayers";
import { DayCard } from "./DayCard";
import { ProgressSummary } from "./ProgressSummary";

export type DayRow = {
  id: string;
  dayIndex: number;
  dayDate: string | null;
  fajr: boolean;
  zuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  witr: boolean;
};

type Props = {
  username: string;
  trackWitr: boolean;
  /** Totals across every day the user has, including ones not sent to the client. */
  totalDays: number;
  totalCompletedPrayers: number;
  totalCompletedDays: number;
  /** The oldest incomplete days plus a slice of completed ones. */
  loadedDays: DayRow[];
  loadedIncompleteCount: number;
  shownLimit: number;
};

type Tab = "remaining" | "completed";

function isComplete(day: DayRow, prayers: readonly PrayerKey[]) {
  return prayers.every((prayer) => day[prayer]);
}

function countDone(day: DayRow, prayers: readonly PrayerKey[]) {
  return prayers.filter((prayer) => day[prayer]).length;
}

export function Dashboard({
  username,
  trackWitr,
  totalDays,
  totalCompletedPrayers,
  totalCompletedDays,
  loadedDays,
  loadedIncompleteCount,
  shownLimit,
}: Props) {
  const prayers = useMemo(() => prayersFor(trackWitr), [trackWitr]);

  // A ref mirrors the state so a burst of taps always reads the latest values
  // rather than whatever was captured when the handler was created.
  const daysRef = useRef<Record<string, DayRow>>(
    Object.fromEntries(loadedDays.map((day) => [day.id, day])),
  );
  const [days, setDays] = useState(daysRef.current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const retries = useRef<Record<string, () => void>>({});
  const [tab, setTab] = useState<Tab>("remaining");

  // The server counts every day; the client only knows about the loaded slice,
  // so track the difference the user has made since load and add it on top.
  const baseline = useRef(
    loadedDays.reduce(
      (acc, day) => {
        acc.prayers += countDone(day, prayers);
        acc.days += isComplete(day, prayers) ? 1 : 0;
        return acc;
      },
      { prayers: 0, days: 0 },
    ),
  );

  function writeDay(id: string, row: DayRow) {
    daysRef.current = { ...daysRef.current, [id]: row };
    setDays(daysRef.current);
  }

  function clearError(id: string) {
    setErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function commit(
    id: string,
    optimistic: DayRow,
    rollback: DayRow,
    save: () => Promise<ActionResult>,
    retry: () => void,
  ) {
    writeDay(id, optimistic);
    clearError(id);
    setBusy((current) => ({ ...current, [id]: true }));

    let result: ActionResult;
    try {
      result = await save();
    } catch {
      result = { ok: false, error: "Couldn't save. Check your connection and retry." };
    }

    setBusy((current) => ({ ...current, [id]: false }));

    if (!result.ok) {
      const message = result.error;
      writeDay(id, rollback);
      retries.current[id] = retry;
      setErrors((current) => ({ ...current, [id]: message }));
    }
  }

  function togglePrayer(id: string, prayer: PrayerKey) {
    const current = daysRef.current[id];
    if (!current) return;
    const nextValue = !current[prayer];
    const optimistic = { ...current, [prayer]: nextValue };

    void commit(
      id,
      optimistic,
      current,
      () => setPrayer(id, prayer, nextValue),
      () => togglePrayer(id, prayer),
    );
  }

  function markWholeDay(id: string) {
    const current = daysRef.current[id];
    if (!current) return;
    const optimistic = { ...current };
    for (const prayer of prayers) optimistic[prayer] = true;

    void commit(
      id,
      optimistic,
      current,
      () => markDayDone(id),
      () => markWholeDay(id),
    );
  }

  const all = Object.values(days).sort((a, b) => a.dayIndex - b.dayIndex);
  const remaining = all.filter((day) => !isComplete(day, prayers));
  const completed = all.filter((day) => isComplete(day, prayers));

  const live = all.reduce(
    (acc, day) => {
      acc.prayers += countDone(day, prayers);
      acc.days += isComplete(day, prayers) ? 1 : 0;
      return acc;
    },
    { prayers: 0, days: 0 },
  );

  const completedPrayers =
    totalCompletedPrayers + (live.prayers - baseline.current.prayers);
  const completedDays = totalCompletedDays + (live.days - baseline.current.days);
  const totalPrayers = totalDays * prayers.length;
  const remainingDays = totalDays - completedDays;
  const allDone = remainingDays <= 0;

  const hasMoreRemaining = loadedIncompleteCount >= shownLimit;
  const list = tab === "remaining" ? remaining : completed;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-16 sm:px-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Qada Tracker</h1>
          <p className="text-sm text-muted">Signed in as {username}</p>
        </div>
        <Link
          href="/settings"
          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium shadow-sm"
        >
          Settings
        </Link>
      </header>

      <ProgressSummary
        completedPrayers={completedPrayers}
        totalPrayers={totalPrayers}
        remainingDays={remainingDays}
        totalDays={totalDays}
      />

      {allDone ? (
        <section className="mt-5 rounded-2xl border border-accent/40 bg-accent-soft p-6 text-center">
          <p className="text-3xl" aria-hidden>
            🎉
          </p>
          <h2 className="mt-2 text-lg font-semibold">Every prayer made up</h2>
          <p className="mt-1 text-sm text-muted">
            You&apos;ve completed all {totalDays.toLocaleString()} days. May they be
            accepted.
          </p>
        </section>
      ) : null}

      <div
        role="tablist"
        aria-label="Day list"
        className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-accent-soft p-1"
      >
        {(
          [
            ["remaining", `Remaining (${remainingDays.toLocaleString()})`],
            ["completed", `Completed (${completedDays.toLocaleString()})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === value ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {tab === "remaining"
            ? "Nothing left in this list."
            : "No completed days yet — check off a prayer to get started."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              prayers={prayers}
              complete={isComplete(day, prayers)}
              error={errors[day.id]}
              busy={Boolean(busy[day.id])}
              onToggle={(prayer) => togglePrayer(day.id, prayer)}
              onMarkDone={() => markWholeDay(day.id)}
              onRetry={() => retries.current[day.id]?.()}
            />
          ))}
        </ul>
      )}

      {tab === "remaining" && hasMoreRemaining ? (
        <p className="mt-5 text-center text-sm text-muted">
          Showing the oldest {shownLimit.toLocaleString()} days first.{" "}
          <Link
            href={`/?show=${shownLimit + 100}`}
            className="font-semibold text-accent underline underline-offset-2"
          >
            Show more
          </Link>
        </p>
      ) : null}

      {tab === "completed" && completedDays > completed.length ? (
        <p className="mt-5 text-center text-sm text-muted">
          Showing {completed.length.toLocaleString()} of{" "}
          {completedDays.toLocaleString()} completed days.
        </p>
      ) : null}
    </main>
  );
}
