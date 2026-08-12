"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dayLabel,
  monthLabel,
  prayersFor,
  type PrayerKey,
} from "@/lib/prayers";
import { setSlot, setWholeDay } from "@/lib/actions/log";
import { LedgerGrid, GridLegend, type GridDay } from "./LedgerGrid";
import { PrayerChip } from "./PrayerChip";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useToast } from "./ui/Toast";

export type LedgerDay = {
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

type View = "grid" | "list";
type Filter = "all" | "outstanding" | "cleared";

/** Rendered rows are capped so a 3,000-day account stays responsive. */
const PAGE_SIZE = 120;

export function LedgerScreen({
  days,
  trackWitr,
  focusId,
  truncated,
  totalDays,
}: {
  days: LedgerDay[];
  trackWitr: boolean;
  focusId?: string;
  truncated: boolean;
  totalDays: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const prayers = useMemo(() => prayersFor(trackWitr), [trackWitr]);

  const stateRef = useRef<Record<string, LedgerDay>>(
    Object.fromEntries(days.map((day) => [day.id, day])),
  );
  const [rows, setRows] = useState(stateRef.current);
  const [view, setView] = useState<View>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(focusId ?? null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [, startTransition] = useTransition();

  // Arriving from a grid cell should land on that day, opened, in list view.
  useEffect(() => {
    if (!focusId) return;
    setView("list");
    setExpanded(focusId);
    const node = document.getElementById(`day-${focusId}`);
    node?.scrollIntoView({ block: "center" });
  }, [focusId]);

  function write(id: string, next: LedgerDay) {
    stateRef.current = { ...stateRef.current, [id]: next };
    setRows(stateRef.current);
  }

  function doneCount(day: LedgerDay) {
    return prayers.filter((prayer) => day[prayer]).length;
  }

  function toggleSlot(id: string, prayer: PrayerKey) {
    const current = stateRef.current[id];
    if (!current) return;
    const value = !current[prayer];
    write(id, { ...current, [prayer]: value });

    startTransition(async () => {
      const result = await setSlot(id, prayer, value).catch(() => ({
        ok: false as const,
        error: "Couldn't save. Check your connection.",
      }));

      if (!result.ok) {
        write(id, { ...stateRef.current[id], [prayer]: !value });
        toast({ message: result.error, tone: "danger" });
        return;
      }
      router.refresh();
    });
  }

  function wholeDay(id: string, value: boolean) {
    const before = stateRef.current[id];
    if (!before) return;

    const next = { ...before };
    for (const prayer of prayers) next[prayer] = value;
    write(id, next);

    startTransition(async () => {
      const result = await setWholeDay(id, value).catch(() => ({
        ok: false as const,
        error: "Couldn't save. Check your connection.",
      }));

      if (!result.ok) {
        write(id, before);
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message: `${dayLabel(before)} ${value ? "cleared" : "reset"}`,
        action: {
          label: "Undo",
          run: async () => {
            write(id, before);
            await setWholeDay(id, !value);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  const all = Object.values(rows).sort((a, b) => a.dayIndex - b.dayIndex);
  const filtered = all.filter((day) => {
    const done = doneCount(day);
    if (filter === "outstanding") return done < prayers.length;
    if (filter === "cleared") return done >= prayers.length;
    return true;
  });
  const visible = filtered.slice(0, limit);

  const gridDays: GridDay[] = all.map((day) => ({
    id: day.id,
    dayIndex: day.dayIndex,
    dayDate: day.dayDate,
    done: doneCount(day),
    total: prayers.length,
  }));
  const targetId = all.find((day) => doneCount(day) < prayers.length)?.id ?? null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="display text-title text-ink">Ledger</h1>

        <SegmentedControl
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
          ]}
        />

        <div role="group" aria-label="Filter days" className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${all.length.toLocaleString()})`],
              ["outstanding", "Outstanding"],
              ["cleared", "Cleared"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setLimit(PAGE_SIZE);
              }}
              className={`min-h-11 rounded-full border px-4 text-meta font-medium transition-colors ${
                filter === value
                  ? "border-brand bg-brand-wash text-brand"
                  : "border-line bg-surface text-ink-3 hover:text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {truncated ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-meta text-ink-3">
          Showing the earliest {all.length.toLocaleString()} of{" "}
          {totalDays.toLocaleString()} days. Clear these and the next stretch loads.
        </p>
      ) : null}

      {view === "grid" ? (
        <section className="flex flex-col gap-4">
          <LedgerGrid
            days={gridDays}
            targetId={targetId}
            onSelect={(day) => {
              setView("list");
              setExpanded(day.id);
              requestAnimationFrame(() => {
                document
                  .getElementById(`day-${day.id}`)
                  ?.scrollIntoView({ block: "center" });
              });
            }}
          />
          <GridLegend />
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          {visible.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-5 py-10 text-center text-meta text-ink-3">
              Nothing in this filter.
            </p>
          ) : null}

          {visible.map((day, index) => {
            const previous = visible[index - 1];
            const month = monthLabel(day.dayDate);
            const showMonth =
              month !== null && month !== monthLabel(previous?.dayDate ?? null);
            const done = doneCount(day);
            const complete = done >= prayers.length;
            const isOpen = expanded === day.id;

            return (
              <div key={day.id}>
                {showMonth ? (
                  <h2 className="sticky top-0 z-10 -mx-1 bg-paper/95 px-1 py-2 text-meta font-medium text-ink-3 backdrop-blur">
                    {month}
                  </h2>
                ) : null}

                <div
                  id={`day-${day.id}`}
                  className={`rounded-md border bg-surface transition-colors ${
                    complete ? "border-done/30" : "border-line"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : day.id)}
                    aria-expanded={isOpen}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="num text-body text-ink">{dayLabel(day)}</p>
                      <div
                        className="mt-2 flex gap-1"
                        aria-hidden="true"
                        title={`${done} of ${prayers.length}`}
                      >
                        {prayers.map((prayer) => (
                          <span
                            key={prayer}
                            className={`h-1.5 flex-1 rounded-full ${
                              day[prayer] ? "bg-done" : "bg-surface-2"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <span className="num shrink-0 text-meta text-ink-3">
                      {done} / {prayers.length}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-ink-3 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {prayers.map((prayer) => (
                          <PrayerChip
                            key={prayer}
                            prayer={prayer}
                            done={day[prayer]}
                            onToggle={() => toggleSlot(day.id, prayer)}
                          />
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => wholeDay(day.id, true)}
                          disabled={complete}
                          className="min-h-11 flex-1 rounded-md border border-line-strong px-4 text-meta font-medium
                                     text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
                        >
                          Mark whole day done
                        </button>
                        <button
                          type="button"
                          onClick={() => wholeDay(day.id, false)}
                          disabled={done === 0}
                          className="min-h-11 rounded-md border border-line px-4 text-meta font-medium
                                     text-ink-3 transition-colors hover:bg-surface-2 disabled:opacity-40"
                        >
                          Reset day
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {filtered.length > visible.length ? (
            <button
              type="button"
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
              className="mt-2 min-h-12 rounded-md border border-line text-body font-medium text-ink-2 hover:bg-surface-2"
            >
              Show more ({(filtered.length - visible.length).toLocaleString()} left)
            </button>
          ) : null}
        </section>
      )}
    </main>
  );
}
