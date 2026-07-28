import type { PrayerDay } from "@/db/schema";

export const BASE_PRAYERS = ["fajr", "zuhr", "asr", "maghrib", "isha"] as const;
export const ALL_PRAYERS = [...BASE_PRAYERS, "witr"] as const;

export type PrayerKey = (typeof ALL_PRAYERS)[number];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Fajr",
  zuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  witr: "Witr",
};

export function isPrayerKey(value: unknown): value is PrayerKey {
  return (
    typeof value === "string" && (ALL_PRAYERS as readonly string[]).includes(value)
  );
}

/** The prayers that count for this user — Witr only when they've turned it on. */
export function prayersFor(trackWitr: boolean): readonly PrayerKey[] {
  return trackWitr ? ALL_PRAYERS : BASE_PRAYERS;
}

export function isDayComplete(
  day: Pick<PrayerDay, PrayerKey>,
  trackWitr: boolean,
): boolean {
  return prayersFor(trackWitr).every((prayer) => day[prayer]);
}

export function countCompleted(
  day: Pick<PrayerDay, PrayerKey>,
  trackWitr: boolean,
): number {
  return prayersFor(trackWitr).filter((prayer) => day[prayer]).length;
}

export type Totals = {
  totalPrayers: number;
  completedPrayers: number;
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  percent: number;
};

export function computeTotals(
  days: Pick<PrayerDay, PrayerKey>[],
  trackWitr: boolean,
): Totals {
  const perDay = prayersFor(trackWitr).length;
  const totalPrayers = days.length * perDay;
  let completedPrayers = 0;
  let completedDays = 0;

  for (const day of days) {
    const done = countCompleted(day, trackWitr);
    completedPrayers += done;
    if (done === perDay) completedDays += 1;
  }

  return {
    totalPrayers,
    completedPrayers,
    totalDays: days.length,
    completedDays,
    remainingDays: days.length - completedDays,
    percent: totalPrayers === 0 ? 0 : Math.round((completedPrayers / totalPrayers) * 100),
  };
}

/** "12 Jan 2025" for dated days, "Day 7" for quick-amount days. */
export function dayLabel(day: Pick<PrayerDay, "dayIndex" | "dayDate">): string {
  if (!day.dayDate) return `Day ${day.dayIndex}`;

  // dayDate is a plain YYYY-MM-DD string — parse the parts directly so the
  // label never shifts by a day because of the viewer's timezone.
  const [year, month, dayOfMonth] = day.dayDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
