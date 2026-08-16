/**
 * The night prayer.
 *
 * Three answers, worded as plain descriptions of what happened rather than as
 * a verdict on the person. "Didn't bother" reads as an accusation; "Slept
 * through" is the same fact without one — and getting up and not managing it
 * is a real, distinct outcome worth recording rather than collapsing into
 * failure.
 */
export const TAHAJJUD_STATUSES = ["prayed", "woke", "slept"] as const;
export type TahajjudStatus = (typeof TAHAJJUD_STATUSES)[number];

export function isTahajjudStatus(value: unknown): value is TahajjudStatus {
  return (
    typeof value === "string" &&
    (TAHAJJUD_STATUSES as readonly string[]).includes(value)
  );
}

export const TAHAJJUD_LABELS: Record<TahajjudStatus, string> = {
  prayed: "Prayed",
  woke: "Woke, didn't pray",
  slept: "Slept through",
};

/** Short forms for tight rows where the full label won't fit. */
export const TAHAJJUD_SHORT: Record<TahajjudStatus, string> = {
  prayed: "Prayed",
  woke: "Woke",
  slept: "Slept",
};

export type TahajjudEntry = {
  prayerDate: string;
  status: TahajjudStatus;
  loggedAt: string;
};

export type TahajjudSummary = {
  prayed: number;
  woke: number;
  slept: number;
  logged: number;
};

export function summariseTahajjud(entries: TahajjudEntry[]): TahajjudSummary {
  const summary: TahajjudSummary = { prayed: 0, woke: 0, slept: 0, logged: 0 };
  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.logged += 1;
  }
  return summary;
}
