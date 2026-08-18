"use client";

import { useEffect, useMemo, useState } from "react";
import { SURAHS, searchSurahs, surahByNumber } from "@/lib/quran";
import { Sheet } from "./ui/Sheet";

/**
 * Pick which surahs were read, rather than how many.
 *
 * Multi-select, because a sitting usually covers more than one, and the list
 * opens on what is already recorded so the same sheet serves adding and
 * correcting. 114 rows need a filter: it matches on number, name or English
 * meaning, and ignores the apostrophes and hyphens people leave out.
 */
export function SurahPicker({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: number[];
  onClose: () => void;
  onSave: (surahs: number[]) => void;
}) {
  const [chosen, setChosen] = useState<number[]>(initial);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setChosen(initial);
    setQuery("");
    // `initial` is a fresh array each render; the open flag is what should
    // reseed the sheet, not the identity of the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matches = useMemo(() => searchSurahs(query), [query]);
  const selected = useMemo(() => new Set(chosen), [chosen]);

  function toggle(number: number) {
    setChosen((current) =>
      current.includes(number)
        ? current.filter((value) => value !== number)
        : [...current, number],
    );
  }

  const ordered = [...chosen].sort((a, b) => a - b);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Which surahs did you read?"
      description="Pick as many as you like. Reading one twice still counts once."
    >
      <div className="flex flex-col gap-4">
        {ordered.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Chosen surahs">
            {ordered.map((number) => {
              const surah = surahByNumber(number);
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => toggle(number)}
                  aria-label={`Remove ${surah?.name ?? number}`}
                  className="flex min-h-9 items-center gap-1.5 rounded-md border border-done bg-done-wash px-2.5 text-meta font-medium text-done"
                >
                  {surah?.name ?? `Surah ${number}`}
                  <span aria-hidden="true">✕</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div>
          <label htmlFor="surah-search" className="mb-1.5 block text-meta text-ink-2">
            Search by name, meaning, or number
          </label>
          <input
            id="surah-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Al-Kahf, The Cave, 18…"
            className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body
                       text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
        </div>

        {matches.length === 0 ? (
          <p className="py-6 text-center text-body text-ink-3">
            No surah matches that.
          </p>
        ) : (
          <ul
            role="listbox"
            aria-label="Surahs"
            aria-multiselectable="true"
            className="-mx-1 flex max-h-80 flex-col gap-1 overflow-y-auto px-1"
          >
            {matches.map((surah) => {
              const isChosen = selected.has(surah.number);
              return (
                <li key={surah.number}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isChosen}
                    onClick={() => toggle(surah.number)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      isChosen
                        ? "border-done bg-done-wash"
                        : "border-line bg-surface-2 hover:border-line-strong"
                    }`}
                  >
                    <span
                      className={`num w-8 shrink-0 text-meta ${
                        isChosen ? "text-done" : "text-ink-3"
                      }`}
                    >
                      {surah.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-body font-medium ${
                          isChosen ? "text-done" : "text-ink"
                        }`}
                      >
                        {surah.name}
                      </span>
                      <span className="block truncate text-meta text-ink-3">
                        {surah.meaning} · <span className="num">{surah.ayahs}</span>{" "}
                        {surah.ayahs === 1 ? "ayah" : "ayahs"}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`shrink-0 text-name ${
                        isChosen ? "text-done" : "text-ink-3"
                      }`}
                    >
                      {isChosen ? "✓" : "+"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-meta text-ink-3">
          Showing <span className="num">{matches.length}</span> of{" "}
          <span className="num">{SURAHS.length}</span>.
        </p>

        <button
          type="button"
          onClick={() => onSave(ordered)}
          className="min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink"
        >
          {ordered.length === 0
            ? "Save with none selected"
            : `Save ${ordered.length} ${ordered.length === 1 ? "surah" : "surahs"}`}
        </button>
      </div>
    </Sheet>
  );
}
