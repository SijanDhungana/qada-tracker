import type { DailyPrayerKey } from "./prayers";

/**
 * The sunnah prayed around each fard prayer. Opt-in, because how many rak'ahs
 * belong to each prayer differs between schools — the app records only whether
 * the user prayed theirs, and never asserts a number.
 */
export type SunnahEntry = {
  prayerDate: string;
  prayer: DailyPrayerKey;
  prayed: boolean;
  loggedAt: string;
};

export type SunnahSummary = { prayed: number; missed: number; logged: number };

export function summariseSunnah(entries: SunnahEntry[]): SunnahSummary {
  const summary: SunnahSummary = { prayed: 0, missed: 0, logged: 0 };
  for (const entry of entries) {
    summary.logged += 1;
    if (entry.prayed) summary.prayed += 1;
    else summary.missed += 1;
  }
  return summary;
}

/** Sunnah entries for one day, keyed by prayer. */
export function sunnahFor(
  entries: SunnahEntry[],
  dateKey: string,
): Partial<Record<DailyPrayerKey, SunnahEntry>> {
  const map: Partial<Record<DailyPrayerKey, SunnahEntry>> = {};
  for (const entry of entries) {
    if (entry.prayerDate === dateKey) map[entry.prayer] = entry;
  }
  return map;
}
