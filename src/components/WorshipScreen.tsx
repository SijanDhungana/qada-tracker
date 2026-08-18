"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  MAX_WORSHIP_COUNT,
  MAX_WORSHIP_STEP,
  WORSHIP,
  WORSHIP_KINDS,
  describeCount,
  kindsInGroup,
  totalDhikr,
  unitFor,
  type WorshipCounts,
  type WorshipKind,
} from "@/lib/worship";
import { describeSurahs, surahByNumber } from "@/lib/quran";
import { formatDateKey, shiftDateKey } from "@/lib/time";
import { bumpWorship, clearWorshipDay, setWorship } from "@/lib/actions/worship";
import { clearSurahDay, setSurahs as setSurahsAction } from "@/lib/actions/quran";
import { SurahPicker } from "./SurahPicker";
import { Sheet } from "./ui/Sheet";
import { useToast } from "./ui/Toast";

export type WorshipData = {
  dateKey: string;
  today: string;
  counts: WorshipCounts;
  /** Totals across the last seven days, for the context line at the top. */
  weekCounts: WorshipCounts;
  /** Surah numbers read on this day. */
  surahs: number[];
};

/**
 * A day's voluntary worship. One button adds to it: pick what, pick how much.
 *
 * The alternative — nine counters always on screen — made the page a wall of
 * rows that were zero most days. Here the page shows only what was actually
 * prayed or recited, and the rest is one tap away.
 */
export function WorshipScreen({ data }: { data: WorshipData }) {
  const router = useRouter();
  const toast = useToast();

  const [counts, setCounts] = useState<WorshipCounts>(data.counts);
  const [surahs, setSurahs] = useState<number[]>(data.surahs);
  const [adding, setAdding] = useState(false);
  const [pickingSurahs, setPickingSurahs] = useState(false);
  const [editing, setEditing] = useState<WorshipKind | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [, startTransition] = useTransition();

  // A different day was navigated to, or the server sent fresh numbers.
  useEffect(() => {
    setCounts(data.counts);
    setSurahs(data.surahs);
  }, [data.counts, data.surahs, data.dateKey]);

  function saveSurahs(next: number[]) {
    const previous = surahs;
    setSurahs(next);
    setPickingSurahs(false);

    startTransition(async () => {
      const result = await setSurahsAction(data.dateKey, next).catch(() => ({
        ok: false as const,
        error: "Couldn't save that. Check your connection.",
      }));

      if (!result.ok) {
        setSurahs(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message:
          next.length === 0
            ? "Surahs cleared"
            : `Qur'an · ${describeSurahs(next)}`,
        coalesceKey: "surahs",
        action: {
          label: "Undo",
          run: async () => {
            setSurahs(previous);
            await setSurahsAction(data.dateKey, previous);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  function add(kind: WorshipKind, amount: number) {
    const previous = counts[kind] ?? 0;
    setCounts((current) => ({
      ...current,
      [kind]: Math.min(MAX_WORSHIP_COUNT, previous + amount),
    }));

    startTransition(async () => {
      const result = await bumpWorship(data.dateKey, kind, amount).catch(() => ({
        ok: false as const,
        error: "Couldn't save that. Check your connection.",
      }));

      if (!result.ok) {
        setCounts((current) => ({ ...current, [kind]: previous }));
        toast({ message: result.error, tone: "danger" });
        return;
      }

      // The server is the authority — it clamps, and it may have merged with a
      // write from another tab.
      setCounts((current) => ({ ...current, [kind]: result.count }));
      toast({
        message: `${WORSHIP[kind].label} · ${describeCount(kind, result.count)} today`,
        coalesceKey: `worship-${kind}`,
        action: {
          label: "Undo",
          run: async () => {
            setCounts((current) => ({ ...current, [kind]: previous }));
            await setWorship(data.dateKey, kind, previous);
            router.refresh();
          },
        },
      });
      router.refresh();
    });
  }

  function saveExact(kind: WorshipKind, value: number) {
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
        return;
      }
      router.refresh();
    });
  }

  function clearDay() {
    const previousCounts = counts;
    const previousSurahs = surahs;
    setCounts({});
    setSurahs([]);
    setClearOpen(false);

    startTransition(async () => {
      const results = await Promise.all(
        [clearWorshipDay(data.dateKey), clearSurahDay(data.dateKey)].map((write) =>
          write.catch(() => ({ ok: false as const, error: "Couldn't clear that day." })),
        ),
      );
      const failure = results.find((result) => !result.ok);
      if (failure) {
        setCounts(previousCounts);
        setSurahs(previousSurahs);
        toast({
          message: "error" in failure ? failure.error : "Couldn't clear that day.",
          tone: "danger",
        });
        return;
      }
      toast({ message: "Day cleared" });
      router.refresh();
    });
  }

  const isToday = data.dateKey === data.today;
  const dhikrToday = totalDhikr(counts);
  const dhikrWeek = totalDhikr(data.weekCounts);
  const logged = WORSHIP_KINDS.filter((kind) => (counts[kind] ?? 0) > 0);
  // Surahs are their own entry on the day, alongside the counted kinds.
  const entryCount = logged.length + (surahs.length > 0 ? 1 : 0);

  function goTo(dateKey: string) {
    if (dateKey > data.today) return;
    router.push(dateKey === data.today ? "/worship" : `/worship?date=${dateKey}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
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
            {entryCount === 0
              ? "Nothing logged yet"
              : `${entryCount} ${entryCount === 1 ? "thing" : "things"} logged`}
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

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-brand text-body font-semibold text-done-ink"
      >
        <span aria-hidden="true" className="text-counter leading-none">
          +
        </span>
        Log worship
      </button>

      {entryCount === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-5 py-8 text-center text-body text-ink-3">
          Nothing logged for this day yet. Tap the button above to add nafl
          rak&apos;ahs, dhikr, or Qur&apos;an.
        </p>
      ) : (
        <section aria-labelledby="logged-heading" className="flex flex-col gap-3">
          <h2 id="logged-heading" className="display text-section text-ink">
            {isToday ? "Today" : formatDateKey(data.dateKey, false)}
          </h2>

          {surahs.length > 0 ? (
            <div className="rounded-md border border-line bg-surface px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-32 flex-1">
                  <p className="text-name font-medium text-ink">Surahs read</p>
                  <p className="text-meta text-ink-3">
                    <span className="num">{surahs.length}</span>{" "}
                    {surahs.length === 1 ? "surah" : "surahs"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickingSurahs(true)}
                  className="min-h-11 shrink-0 rounded-md border border-line px-3 text-meta font-medium text-ink-2 hover:bg-surface-2"
                >
                  Change
                </button>
              </div>

              <ul aria-label="Surahs read" className="mt-2.5 flex flex-wrap gap-1.5">
                {[...surahs]
                  .sort((a, b) => a - b)
                  .map((number) => (
                    <li
                      key={number}
                      className="rounded-md border border-done/40 bg-done-wash px-2.5 py-1 text-meta font-medium text-done"
                    >
                      <span className="num">{number}</span>.{" "}
                      {surahByNumber(number)?.name ?? "Unknown"}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {logged.map((kind) => (
              <li
                key={kind}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-line bg-surface px-3 py-3"
              >
                <div className="min-w-32 flex-1">
                  <p className="text-name font-medium text-ink">
                    {WORSHIP[kind].label}
                  </p>
                  {/* Only the number is tabular — running the class over the
                      words as well would set them in the numeric face. */}
                  <p className="text-meta text-ink-3">
                    <span className="num">
                      {(counts[kind] ?? 0).toLocaleString()}
                    </span>{" "}
                    {unitFor(kind, counts[kind] ?? 0)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(kind)}
                    className="min-h-11 rounded-md border border-line px-3 text-meta font-medium text-ink-2 hover:bg-surface-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => add(kind, WORSHIP[kind].step)}
                    aria-label={`Add ${WORSHIP[kind].step} to ${WORSHIP[kind].label}`}
                    className="grid size-11 place-items-center rounded-md bg-brand text-name font-semibold text-done-ink"
                  >
                    +{WORSHIP[kind].step > 1 ? WORSHIP[kind].step : ""}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {dhikrToday > 0 ? (
            <p className="text-meta text-ink-3">
              <span className="num text-ink-2">{dhikrToday.toLocaleString()}</span>{" "}
              dhikr in all
              {dhikrWeek > dhikrToday ? (
                <>
                  {" · "}
                  <span className="num text-ink-2">
                    {dhikrWeek.toLocaleString()}
                  </span>{" "}
                  over the last seven days
                </>
              ) : null}
            </p>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="min-h-11 rounded-md border border-line px-4 text-body font-medium text-ink-2 hover:bg-surface-2"
            >
              Clear this day
            </button>
          </div>
        </section>
      )}

      <AddSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(kind, amount) => {
          add(kind, amount);
          setAdding(false);
        }}
        onPickSurahs={() => {
          setAdding(false);
          setPickingSurahs(true);
        }}
      />

      <SurahPicker
        open={pickingSurahs}
        initial={surahs}
        onClose={() => setPickingSurahs(false)}
        onSave={saveSurahs}
      />

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

/** Pick what was done, then how much of it. */
function AddSheet({
  open,
  onClose,
  onAdd,
  onPickSurahs,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (kind: WorshipKind, amount: number) => void;
  /** Surahs skip the amount step — you choose which ones, not how many. */
  onPickSurahs: () => void;
}) {
  const [kind, setKind] = useState<WorshipKind | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(null);
    setText("");
  }, [open]);

  function choose(next: WorshipKind) {
    setKind(next);
    // Seed the amount with one step, so the common case is pick-and-add.
    setText(String(WORSHIP[next].step));
  }

  const amount = Number(text);
  const valid =
    kind !== null &&
    text.trim() !== "" &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= MAX_WORSHIP_STEP;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind ? WORSHIP[kind].label : "Log worship"}
      description={
        kind
          ? "How much are you adding to today?"
          : "Pick what you prayed or recited."
      }
    >
      {kind === null ? (
        <div className="flex flex-col gap-5">
          {GROUP_ORDER.map((group) => (
            <div key={group}>
              <p className="mb-2 text-meta font-medium tracking-wide text-ink-3 uppercase">
                {GROUP_LABELS[group]}
              </p>
              <div
                role="group"
                aria-label={GROUP_LABELS[group]}
                className="flex flex-col gap-2"
              >
                {group === "quran" ? (
                  <button
                    type="button"
                    onClick={onPickSurahs}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-left hover:border-brand"
                  >
                    <span>
                      <span className="block text-body font-medium text-ink">
                        Surahs read
                      </span>
                      <span className="block text-meta text-ink-3">
                        Pick which surahs, by name or number
                      </span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-ink-3">
                      ›
                    </span>
                  </button>
                ) : null}

                {kindsInGroup(group).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => choose(option)}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-left hover:border-brand"
                  >
                    <span>
                      <span className="block text-body font-medium text-ink">
                        {WORSHIP[option].label}
                      </span>
                      {WORSHIP[option].sub ? (
                        <span className="block text-meta text-ink-3">
                          {WORSHIP[option].sub}
                        </span>
                      ) : null}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-ink-3">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {quickAmounts(kind).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setText(String(value))}
                aria-pressed={amount === value}
                className={`min-h-11 rounded-md border px-3.5 text-meta font-medium transition-colors ${
                  amount === value
                    ? "border-brand bg-brand-wash text-brand"
                    : "border-line bg-surface-2 text-ink-2 hover:text-ink"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="worship-amount" className="mb-1.5 block text-meta text-ink-2">
              How many {WORSHIP[kind].unit[1]}?
            </label>
            <input
              id="worship-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_WORSHIP_STEP}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink outline-none focus:border-brand"
            />
            <p className="mt-1.5 text-meta text-ink-3">
              Up to {MAX_WORSHIP_STEP.toLocaleString()} at a time. Add again for
              more.
            </p>
          </div>

          <button
            type="button"
            disabled={!valid}
            onClick={() => onAdd(kind, amount)}
            className="min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink disabled:opacity-50"
          >
            Add {valid ? describeCount(kind, amount) : ""}
          </button>

          <button
            type="button"
            onClick={() => setKind(null)}
            className="min-h-12 w-full rounded-md border border-line text-body font-medium text-ink-2"
          >
            Pick something else
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Sensible jumps for this kind, without repeating the step itself twice. */
function quickAmounts(kind: WorshipKind): number[] {
  const definition = WORSHIP[kind];
  return [definition.step, ...definition.quickAdds].filter(
    (value, index, all) => all.indexOf(value) === index,
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
      description="Set the total for this day. Useful after counting on a tasbih."
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
        <p className="text-meta text-ink-3">Set it to 0 to remove it from the day.</p>
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
