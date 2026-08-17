import type { DailyPrayerKey } from "./prayers";

/**
 * The voluntary rak'ahs that sit around each fard prayer.
 *
 * `before` and `after` are the rawatib sunnah; `nafl` is the extra voluntary
 * pair after the sunnah. Witr is not here — it has its own record, because it
 * belongs to the night rather than to any one of the five.
 */
export const SUNNAH_PARTS = ["before", "after", "nafl"] as const;
export type SunnahPart = (typeof SUNNAH_PARTS)[number];

export function isSunnahPart(value: unknown): value is SunnahPart {
  return (
    typeof value === "string" && (SUNNAH_PARTS as readonly string[]).includes(value)
  );
}

export type PartSpec = {
  part: SunnahPart;
  rakahs: number;
  /**
   * Sunnah muakkadah — the ones the Prophet ﷺ kept to consistently. The
   * distinction is shown but never enforced: an unemphasised rak'ah left
   * unlogged is not a failure and the screen never marks it as one.
   */
  emphasised: boolean;
};

/**
 * Rak'ah counts follow the common Hanafi arrangement. They are labels on the
 * buttons, not rules — the app records what you tell it you prayed and never
 * checks your number against this table.
 */
export const SUNNAH_STRUCTURE: Record<DailyPrayerKey, PartSpec[]> = {
  fajr: [{ part: "before", rakahs: 2, emphasised: true }],
  zuhr: [
    { part: "before", rakahs: 4, emphasised: true },
    { part: "after", rakahs: 2, emphasised: true },
    { part: "nafl", rakahs: 2, emphasised: false },
  ],
  asr: [{ part: "before", rakahs: 4, emphasised: false }],
  maghrib: [
    { part: "after", rakahs: 2, emphasised: true },
    { part: "nafl", rakahs: 2, emphasised: false },
  ],
  isha: [
    { part: "before", rakahs: 4, emphasised: false },
    { part: "after", rakahs: 2, emphasised: true },
    { part: "nafl", rakahs: 2, emphasised: false },
  ],
};

export const PART_LABELS: Record<SunnahPart, string> = {
  before: "Sunnah before",
  after: "Sunnah after",
  nafl: "Nafl after",
};

/** The noun alone, so markup can set the number in the tabular face by itself. */
export function rakahNoun(count: number): string {
  return count === 1 ? "rak'ah" : "rak'ahs";
}

/** "2 rak'ahs" / "1 rak'ah" — for aria-labels and other plain strings. */
export function rakahLabel(count: number): string {
  return `${count} ${rakahNoun(count)}`;
}

export function partsFor(prayer: DailyPrayerKey): PartSpec[] {
  return SUNNAH_STRUCTURE[prayer];
}

/** Whether this prayer has any voluntary rak'ahs attached at all. */
export function hasParts(prayer: DailyPrayerKey): boolean {
  return SUNNAH_STRUCTURE[prayer].length > 0;
}

export type SunnahEntry = {
  prayerDate: string;
  prayer: DailyPrayerKey;
  part: SunnahPart;
  prayed: boolean;
  loggedAt: string;
};

/** Answers for one prayer on one day, keyed by part. */
export type PartAnswers = Partial<Record<SunnahPart, boolean>>;

export function answersFor(
  entries: SunnahEntry[],
  dateKey: string,
  prayer: DailyPrayerKey,
): PartAnswers {
  const answers: PartAnswers = {};
  for (const entry of entries) {
    if (entry.prayerDate === dateKey && entry.prayer === prayer) {
      answers[entry.part] = entry.prayed;
    }
  }
  return answers;
}

/**
 * A one-line account of what was kept for this prayer: "4 + 2 = 6 rak'ahs".
 * A single block needs no sum — "2 = 2 rak'ahs" only reads as clutter.
 */
export function describeParts(
  prayer: DailyPrayerKey,
  answers: PartAnswers,
): string | null {
  const prayed = partsFor(prayer).filter((spec) => answers[spec.part] === true);
  if (prayed.length === 0) return null;

  const total = prayed.reduce((sum, spec) => sum + spec.rakahs, 0);
  if (prayed.length === 1) return rakahLabel(total);
  return `${prayed.map((spec) => spec.rakahs).join(" + ")} = ${rakahLabel(total)}`;
}

export type SunnahSummary = {
  prayed: number;
  missed: number;
  logged: number;
  /** Of the answered ones, how many were the emphasised sunnah. */
  emphasisedPrayed: number;
  emphasisedLogged: number;
  /** Rak'ahs across every part marked prayed. */
  rakahs: number;
};

export function summariseSunnah(entries: SunnahEntry[]): SunnahSummary {
  const summary: SunnahSummary = {
    prayed: 0,
    missed: 0,
    logged: 0,
    emphasisedPrayed: 0,
    emphasisedLogged: 0,
    rakahs: 0,
  };

  for (const entry of entries) {
    const spec = partsFor(entry.prayer).find((item) => item.part === entry.part);
    if (!spec) continue;

    summary.logged += 1;
    if (entry.prayed) {
      summary.prayed += 1;
      summary.rakahs += spec.rakahs;
    } else {
      summary.missed += 1;
    }

    if (spec.emphasised) {
      summary.emphasisedLogged += 1;
      if (entry.prayed) summary.emphasisedPrayed += 1;
    }
  }

  return summary;
}
