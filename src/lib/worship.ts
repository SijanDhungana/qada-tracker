/**
 * Voluntary worship logged as running daily totals — nafl rak'ahs, dhikr, and
 * how much Qur'an was read.
 *
 * Each kind is one row per day carrying a count, so a tasbih session is a
 * series of increments to a single row. Nothing here touches the qada ledger:
 * this is extra, and the app never treats a low number as a debt.
 */

export const WORSHIP_KINDS = [
  "nafl_rakah",
  "subhanallah",
  "alhamdulillah",
  "allahu_akbar",
  "tahlil",
  "durood",
  "astaghfirullah",
  // Surahs are not here: which surah was read is a set of names, not a number,
  // so it lives in quran_log. Juz stay a count, where a count is the point.
  "quran_juz",
] as const;

export type WorshipKind = (typeof WORSHIP_KINDS)[number];

export function isWorshipKind(value: unknown): value is WorshipKind {
  return (
    typeof value === "string" && (WORSHIP_KINDS as readonly string[]).includes(value)
  );
}

/** Guards against a runaway counter — a stuck button can't write nonsense. */
export const MAX_WORSHIP_COUNT = 100_000;
/** The largest jump a single write may apply, in either direction. */
export const MAX_WORSHIP_STEP = 1_000;

export type WorshipGroup = "prayer" | "dhikr" | "quran";

export type WorshipDefinition = {
  kind: WorshipKind;
  group: WorshipGroup;
  /** What the counter is called. */
  label: string;
  /** Transliteration or gloss shown under the label; null when the label says it all. */
  sub: string | null;
  /** Singular and plural nouns for the number, e.g. "12 rak'ahs". */
  unit: [singular: string, plural: string];
  /** How much one tap of the main button adds. */
  step: number;
  /** Extra jump buttons offered beside it. */
  quickAdds: number[];
};

export const WORSHIP: Record<WorshipKind, WorshipDefinition> = {
  nafl_rakah: {
    kind: "nafl_rakah",
    group: "prayer",
    label: "Nafl rak'ahs",
    sub: "Voluntary rak'ahs beyond the fard and sunnah",
    unit: ["rak'ah", "rak'ahs"],
    step: 2,
    quickAdds: [4],
  },
  subhanallah: {
    kind: "subhanallah",
    group: "dhikr",
    label: "SubhanAllah",
    sub: "Glory be to Allah",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [33, 100],
  },
  alhamdulillah: {
    kind: "alhamdulillah",
    group: "dhikr",
    label: "Alhamdulillah",
    sub: "All praise is for Allah",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [33, 100],
  },
  allahu_akbar: {
    kind: "allahu_akbar",
    group: "dhikr",
    label: "Allahu akbar",
    sub: "Allah is the greatest",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [34, 100],
  },
  tahlil: {
    kind: "tahlil",
    group: "dhikr",
    label: "La ilaha illallah",
    sub: "There is no god but Allah",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [33, 100],
  },
  durood: {
    kind: "durood",
    group: "dhikr",
    label: "Durood",
    // No ﷺ glyph: it has no reliable font on most Android and desktop
    // browsers and falls back to an oversized emoji that breaks the line.
    sub: "Salawat upon the Prophet",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [10, 100],
  },
  astaghfirullah: {
    kind: "astaghfirullah",
    group: "dhikr",
    label: "Astaghfirullah",
    sub: "I seek Allah's forgiveness",
    unit: ["time", "times"],
    step: 1,
    quickAdds: [33, 100],
  },
  quran_juz: {
    kind: "quran_juz",
    group: "quran",
    label: "Juz read",
    sub: null,
    unit: ["juz", "juz"],
    step: 1,
    quickAdds: [],
  },
};

export const GROUP_LABELS: Record<WorshipGroup, string> = {
  prayer: "Nafl prayer",
  dhikr: "Dhikr",
  quran: "Qur'an",
};

export const GROUP_ORDER: WorshipGroup[] = ["prayer", "dhikr", "quran"];

export function kindsInGroup(group: WorshipGroup): WorshipKind[] {
  return WORSHIP_KINDS.filter((kind) => WORSHIP[kind].group === group);
}

/** "rak'ah" or "rak'ahs", whichever this number takes. */
export function unitFor(kind: WorshipKind, count: number): string {
  const [singular, plural] = WORSHIP[kind].unit;
  return count === 1 ? singular : plural;
}

/** "1 rak'ah" / "12 rak'ahs" */
export function describeCount(kind: WorshipKind, count: number): string {
  return `${count.toLocaleString()} ${unitFor(kind, count)}`;
}

/** A day's counts, keyed by kind. Kinds with nothing logged are simply absent. */
export type WorshipCounts = Partial<Record<WorshipKind, number>>;

export type WorshipRowValue = {
  prayerDate: string;
  kind: WorshipKind;
  count: number;
};

export function countsFor(rows: WorshipRowValue[], dateKey: string): WorshipCounts {
  const counts: WorshipCounts = {};
  for (const row of rows) {
    if (row.prayerDate !== dateKey) continue;
    counts[row.kind] = row.count;
  }
  return counts;
}

/** Every dhikr said today, across the six phrases. */
export function totalDhikr(counts: WorshipCounts): number {
  return kindsInGroup("dhikr").reduce((sum, kind) => sum + (counts[kind] ?? 0), 0);
}

/** A one-line summary for the card on Today: the parts that actually happened. */
export function summariseDay(
  counts: WorshipCounts,
  surahsRead = 0,
): string | null {
  const parts: string[] = [];

  const nafl = counts.nafl_rakah ?? 0;
  if (nafl > 0) parts.push(describeCount("nafl_rakah", nafl));

  const dhikr = totalDhikr(counts);
  if (dhikr > 0) parts.push(`${dhikr.toLocaleString()} dhikr`);

  if (surahsRead > 0) {
    parts.push(`${surahsRead} ${surahsRead === 1 ? "surah" : "surahs"}`);
  }

  const juz = counts.quran_juz ?? 0;
  if (juz > 0) parts.push(describeCount("quran_juz", juz));

  return parts.length > 0 ? parts.join(" · ") : null;
}
