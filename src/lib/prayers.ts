import type { PrayerDay } from "@/db/schema";

export const BASE_PRAYERS = ["fajr", "zuhr", "asr", "maghrib", "isha"] as const;
export const ALL_PRAYERS = [...BASE_PRAYERS, "witr"] as const;

export type PrayerKey = (typeof ALL_PRAYERS)[number];
/** The five daily prayers — Witr is not prayed in congregation, so it's excluded. */
export type DailyPrayerKey = (typeof BASE_PRAYERS)[number];

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Fajr",
  zuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  witr: "Witr",
};

/** Column name holding the moment a slot was logged. */
export const LOGGED_AT_COLUMN = {
  fajr: "fajrAt",
  zuhr: "zuhrAt",
  asr: "asrAt",
  maghrib: "maghribAt",
  isha: "ishaAt",
  witr: "witrAt",
} as const satisfies Record<PrayerKey, keyof PrayerDay>;

export function isPrayerKey(value: unknown): value is PrayerKey {
  return (
    typeof value === "string" && (ALL_PRAYERS as readonly string[]).includes(value)
  );
}

export function isDailyPrayerKey(value: unknown): value is DailyPrayerKey {
  return (
    typeof value === "string" && (BASE_PRAYERS as readonly string[]).includes(value)
  );
}

/** The prayers that count for this user — Witr only when they've turned it on. */
export function prayersFor(trackWitr: boolean): readonly PrayerKey[] {
  return trackWitr ? ALL_PRAYERS : BASE_PRAYERS;
}

type SlotBooleans = Pick<PrayerDay, PrayerKey>;

export function isDayComplete(day: SlotBooleans, trackWitr: boolean): boolean {
  return prayersFor(trackWitr).every((prayer) => day[prayer]);
}

export function countCompleted(day: SlotBooleans, trackWitr: boolean): number {
  return prayersFor(trackWitr).filter((prayer) => day[prayer]).length;
}

/** "17 May 2025" for dated days, "Day 7" for quick-amount days. */
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

/** "May 2025" — used to group ledger rows. */
export function monthLabel(dayDate: string | null): string | null {
  if (!dayDate) return null;
  const [year, month] = dayDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
