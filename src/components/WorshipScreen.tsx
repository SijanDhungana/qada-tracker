"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  MAX_WORSHIP_COUNT,
  WORSHIP,
  describeCount,
  kindsInGroup,
  totalDhikr,
  type WorshipCounts,
  type WorshipKind,
} from "@/lib/worship";
import { formatDateKey, shiftDateKey } from "@/lib/time";
import { bumpWorship, clearWorshipDay, setWorship } from "@/lib/actions/worship";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";

/**
 * Taps are absorbed locally and flushed as one write per kind after a short
 * pause. A hundred-count dhikr session is a hundred instant screen updates and
 * a handful of requests, rather than a hundred round trips racing each other.
 */
const FLUSH_DELAY_MS = 700;

export type WorshipData = {
  dateKey: string;
  today: string;
  counts: WorshipCounts;
  /** Totals across the last seven days, for the context line at the top. */
  weekCounts: WorshipCounts;
};

export function WorshipScreen({ data }: { data: WorshipData }) {
  const router = useRouter();
  const toast = useToast();

  const [counts, setCounts] = useState<WorshipCounts>(data.counts);
  const [editing, setEditing] = useState<WorshipKind | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Deltas waiting to be written, and the timers that will write them.
  const pendingRef = useRef<Partial<Record<WorshipKind, number>>>({});
  const timersRef = useRef<Partial<Record<WorshipKind, ReturnType<typeof setTimeout>>>>(
    {},
  );

  // A different day was navigated to, or the server sent fresh numbers.
  useEffect(() => {
    setCounts(data.counts);
  }, [data.counts, data.dateKey]);

  const flush = useCallback(
    (kind: WorshipKind) => {
      const delta = pendingRef.current[kind] ?? 0;
      delete pendingRef.current[kind];
      delete timersRef.current[kind];
      if (delta === 0) return;

      startTransition(async () => {
        const result = await bumpWorship(data.dateKey, kind, delta).catch(() => ({
          ok: false as const,
          error: "Couldn't save that. Check your connection.",
        }));

        if (!result.ok) {
          // Put the taps back so the screen matches what was actually stored.
          setCounts((current) => ({
            ...current,
            [kind]: Math.max(0, (current[kind] ?? 0) - delta),
          }));
          toast({ message: result.error, tone: "danger" });
          return;
        }

        // The server clamped or merged with a concurrent write; take its word,
        // but keep any taps that arrived while this request was in flight.
        const stillPending = pendingRef.current[kind] ?? 0;
        setCounts((current) => ({ ...current, [kind]: result.count + stillPending }));
      });
    },
    [data.dateKey, toast],
  );

  // Anything still queued when the screen goes away would otherwise be lost.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const kind of Object.keys(timers) as WorshipKind[]) {
        clearTimeout(timers[kind]);
      }
    };
  }, []);

  function bump(kind: WorshipKind, delta: number) {
    setCounts((current) => ({
      ...current,
      [kind]: Math.min(MAX_WORSHIP_COUNT, Math.max(0, (current[kind] ?? 0) + delta)),
    }));

    pendingRef.current[kind] = (pendingRef.current[kind] ?? 0) + delta;
    clearTimeout(timersRef.current[kind]);
    timersRef.current[kind] = setTimeout(() => flush(kind), FLUSH_DELAY_MS);
  }

  function saveExact(kind: WorshipKind, value: number) {
    // A typed number replaces everything, so any queued taps are stale.
    clearTimeout(timersRef.current[kind]);
    delete timersRef.current[kind];
    delete pendingRef.current[kind];

    const previous = counts[kind] ?? 0;
    setCounts((current) => ({ ...current, [kind]: value }));

    startTransition(async () => {
      const result = await setWorship(data.dateKey, kind, value).catch(() => ({
        ok: false as const,
        error: "Couldn't save that.",
      }));
      if (!result.ok) {
        setCounts((current) => ({ ...current, [kind]: previous }));
        toast({ message: result.error, tone: "danger" });
      }
    });
  }

  function clearDay() {
    const previous = counts;
    setCounts({});
    setClearOpen(false);

    startTransition(async () => {
      const result = await clearWorshipDay(data.dateKey).catch(() => ({
        ok: false as const,
        error: "Couldn't clear that day.",
      }));
      if (!result.ok) {
        setCounts(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }
      toast({ message: "Day cleared" });
      router.refresh();
    });
  }

  const isToday = data.dateKey === data.today;
  const dhikrToday = totalDhikr(counts);
  const dhikrWeek = totalDhikr(data.weekCounts);
  const anythingLogged = Object.values(counts).some((value) => (value ?? 0) > 0);

  function goTo(dateKey: string) {
    if (dateKey > data.today) return;
    router.push(dateKey === data.today ? "/worship" : `/worship?date=${dateKey}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="display text-title text-ink">Acts of worship</h1>
        <p className="text-body text-ink-2">
          Everything here is extra. Nothing counts against your qada, and a quiet
          day is still a day.
        </p>
      </header>

      {/* Which day is being logged. */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
        <button
          type="button"
          onClick={() => goTo(shiftDateKey(data.dateKey, -1))}
          aria-label="Previous day"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2"
        >
          ‹
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-name font-medium text-ink">
            {isToday ? "Today" : formatDateKey(data.dateKey)}
          </p>
          <p className="text-meta text-ink-3">
            {dhikrToday > 0
              ? `${dhikrToday.toLocaleString()} dhikr logged`
              : "Nothing logged yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => goTo(shiftDateKey(data.dateKey, 1))}
          disabled={isToday}
          aria-label="Next day"
          className="grid size-11 shrink-0 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Only worth saying once the week holds more than the day already shows. */}
      {dhikrWeek > dhikrToday ? (
        <p className="text-meta text-ink-3">
          <span className="num text-ink-2">{dhikrWeek.toLocaleString()}</span> dhikr
          over the last seven days.
        </p>
      ) : null}

      {GROUP_ORDER.map((group) => (
        <section key={group} aria-labelledby={`${group}-heading`} className="flex flex-col gap-3">
          <h2 id={`${group}-heading`} className="display text-section text-ink">
            {GROUP_LABELS[group]}
          </h2>
          <ul className="flex flex-col gap-2">
            {kindsInGroup(group).map((kind) => (
              <CounterRow
                key={kind}
                kind={kind}
                count={counts[kind] ?? 0}
                onBump={(delta) => bump(kind, delta)}
                onEdit={() => setEditing(kind)}
              />
            ))}
          </ul>
        </section>
      ))}

      <div>
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          disabled={!anythingLogged}
          className="min-h-11 rounded-md border border-line px-4 text-body font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          Clear this day
        </button>
      </div>

      <ExactSheet
        kind={editing}
        current={editing ? (counts[editing] ?? 0) : 0}
        onClose={() => setEditing(null)}
        onSave={(value) => {
          if (editing) saveExact(editing, value);
          setEditing(null);
        }}
      />

      <Sheet
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear this day"
        description="Sets every count on this day back to nothing."
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">
            {isToday ? "Today's" : `${formatDateKey(data.dateKey, false)}'s`} worship
            counts will be removed. Other days are untouched.
          </p>
          <button
            type="button"
            onClick={clearDay}
            className="min-h-12 w-full rounded-md bg-danger text-body font-semibold text-paper"
          >
            Clear the day
          </button>
          <button
            type="button"
            onClick={() => setClearOpen(false)}
            className="min-h-12 w-full rounded-md border border-line text-body font-medium text-ink-2"
          >
            Keep it
          </button>
        </div>
      </Sheet>
    </main>
  );
}

function CounterRow({
  kind,
  count,
  onBump,
  onEdit,
}: {
  kind: WorshipKind;
  count: number;
  onBump: (delta: number) => void;
  onEdit: () => void;
}) {
  const definition = WORSHIP[kind];

  return (
    <li className="rounded-md border border-line bg-surface px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <div className="min-w-32 flex-1">
          <p className="text-name font-medium text-ink">{definition.label}</p>
          {definition.sub ? (
            <p className="text-meta text-ink-3">{definition.sub}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onBump(-definition.step)}
            disabled={count <= 0}
            aria-label={`Remove ${definition.step} from ${definition.label}`}
            className="grid size-11 place-items-center rounded-md border border-line text-name text-ink-2 hover:bg-surface-2 disabled:opacity-30"
          >
            −
          </button>

          <button
            type="button"
            onClick={onEdit}
            aria-label={`${definition.label}: ${describeCount(kind, count)}. Type an exact number.`}
            className="num min-w-16 rounded-md px-1 text-center text-counter text-ink hover:bg-surface-2"
          >
            {count.toLocaleString()}
          </button>

          <button
            type="button"
            onClick={() => onBump(definition.step)}
            aria-label={`Add ${definition.step} to ${definition.label}`}
            className="grid size-11 place-items-center rounded-md bg-brand text-name font-semibold text-done-ink"
          >
            +{definition.step > 1 ? definition.step : ""}
          </button>
        </div>
      </div>

      {definition.quickAdds.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {definition.quickAdds.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onBump(amount)}
              className="min-h-9 rounded-md border border-line px-3 text-meta font-medium text-ink-3 hover:bg-surface-2 hover:text-ink-2"
            >
              +{amount}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function ExactSheet({
  kind,
  current,
  onClose,
  onSave,
}: {
  kind: WorshipKind | null;
  current: number;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (kind) setText(String(current));
  }, [kind, current]);

  const parsed = Number(text);
  const valid =
    text.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed <= MAX_WORSHIP_COUNT;

  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={kind ? WORSHIP[kind].label : ""}
      description="Type the total for this day. Useful after counting on a tasbih."
    >
      <div className="flex flex-col gap-4">
        <label htmlFor="worship-exact" className="text-meta text-ink-2">
          Total for this day
        </label>
        <input
          id="worship-exact"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_WORSHIP_COUNT}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink outline-none focus:border-brand"
        />
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(parsed)}
          className="min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
