"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BASE_PRAYERS, PRAYER_LABELS } from "@/lib/prayers";
import {
  STATUS_SHORT,
  formatDateKey,
  hardestPrayer,
  summarise,
  topReasons,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";
import { SegmentedControl } from "./ui/SegmentedControl";

const DOT: Record<MasjidStatus, string> = {
  masjid: "bg-done",
  alone: "bg-done-2",
  missed: "bg-surface-3",
};

type Range = "7" | "30" | "90";

export function MasjidHistory({ entries }: { entries: MasjidEntry[] }) {
  const [range, setRange] = useState<Range>("30");

  const cutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [range]);

  const scoped = useMemo(
    () => entries.filter((entry) => entry.prayerDate >= cutoff),
    [entries, cutoff],
  );

  const summary = summarise(scoped);
  const reasons = topReasons(scoped);
  const hardest = hardestPrayer(scoped);

  // Group into days, newest first.
  const byDay = useMemo(() => {
    const map = new Map<string, MasjidEntry[]>();
    for (const entry of scoped) {
      const list = map.get(entry.prayerDate) ?? [];
      list.push(entry);
      map.set(entry.prayerDate, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [scoped]);

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

      {summary.logged === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-12 text-center text-body text-ink-3">
          Nothing logged in this stretch yet. Record today&apos;s prayers from the
          Today screen and they&apos;ll show up here.
        </p>
      ) : (
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
                        style={{
                          width: `${(item.count / reasons[0].count) * 100}%`,
                        }}
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

          <section className="flex flex-col gap-2">
            <h2 className="display text-section text-ink">Day by day</h2>
            <ul className="flex flex-col gap-2">
              {byDay.map(([date, dayEntries]) => {
                const lookup = new Map(
                  dayEntries.map((entry) => [entry.prayer, entry]),
                );
                const notes = dayEntries.filter(
                  (entry) => entry.status !== "masjid" && entry.reason,
                );

                return (
                  <li
                    key={date}
                    className="rounded-md border border-line bg-surface px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="num text-body text-ink">{formatDateKey(date)}</p>
                      <div className="flex gap-1.5">
                        {BASE_PRAYERS.map((prayer) => {
                          const entry = lookup.get(prayer);
                          return (
                            <span
                              key={prayer}
                              title={
                                entry
                                  ? `${PRAYER_LABELS[prayer]}: ${STATUS_SHORT[entry.status]}`
                                  : `${PRAYER_LABELS[prayer]}: not logged`
                              }
                              className={`grid size-7 place-items-center rounded-sm text-[0.625rem] font-medium ${
                                entry
                                  ? `${DOT[entry.status]} ${
                                      entry.status === "masjid"
                                        ? "text-done-ink"
                                        : entry.status === "alone"
                                          ? "text-done-ink"
                                          : "text-ink-3"
                                    }`
                                  : "border border-dashed border-line text-ink-3"
                              }`}
                            >
                              {PRAYER_LABELS[prayer].slice(0, 1)}
                            </span>
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
        </>
      )}
    </main>
  );
}
