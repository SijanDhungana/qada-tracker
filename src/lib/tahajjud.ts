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

/**
 * Rak'ahs come in pairs, so the stepper moves in twos — but the stored number
 * is whatever the user lands on, because someone folding witr into the night
 * ends on an odd count and the record shouldn't argue with them.
 */
export const TAHAJJUD_RAKAH_STEP = 2;
export const DEFAULT_TAHAJJUD_RAKAHS = 2;
export const MAX_TAHAJJUD_RAKAHS = 100;

export type TahajjudEntry = {
  prayerDate: string;
  status: TahajjudStatus;
  /** Only set on a night that was prayed, and only when the user opted in. */
  rakahs: number | null;
  loggedAt: string;
};

/** "Prayed · 8 rak'ahs" */
export function describeTahajjud(entry: TahajjudEntry): string {
  const label = TAHAJJUD_LABELS[entry.status];
  if (entry.status !== "prayed" || !entry.rakahs) return label;
  return `${label} · ${entry.rakahs} rak'ah${entry.rakahs === 1 ? "" : "s"}`;
}

export type TahajjudSummary = {
  prayed: number;
  woke: number;
  slept: number;
  logged: number;
  /** Rak'ahs across every night that recorded a count. */
  rakahs: number;
};

export function summariseTahajjud(entries: TahajjudEntry[]): TahajjudSummary {
  const summary: TahajjudSummary = {
    prayed: 0,
    woke: 0,
    slept: 0,
    logged: 0,
    rakahs: 0,
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.logged += 1;
    if (entry.status === "prayed" && entry.rakahs) summary.rakahs += entry.rakahs;
  }
  return summary;
}
