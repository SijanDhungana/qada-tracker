/**
 * Duha — the forenoon prayer, from after sunrise until just before Zuhr.
 *
 * Two answers rather than Tahajjud's three: there is no "woke without praying"
 * middle case in broad daylight, so the honest options are that it happened or
 * it didn't. The rak'ah count is always asked on a day it was prayed, because
 * with Duha the number is the substance of the record — two and eight are both
 * ordinary, and a bare tick would throw away the only interesting part.
 */
export const DUHA_STATUSES = ["prayed", "missed"] as const;
export type DuhaStatus = (typeof DUHA_STATUSES)[number];

export function isDuhaStatus(value: unknown): value is DuhaStatus {
  return (
    typeof value === "string" && (DUHA_STATUSES as readonly string[]).includes(value)
  );
}

export const DUHA_LABELS: Record<DuhaStatus, string> = {
  prayed: "Prayed",
  missed: "Missed",
};

/** Prayed in pairs, so the stepper moves in twos and starts at the minimum. */
export const DUHA_RAKAH_STEP = 2;
export const DEFAULT_DUHA_RAKAHS = 2;
export const MAX_DUHA_RAKAHS = 100;

export type DuhaEntry = {
  prayerDate: string;
  status: DuhaStatus;
  /** Only set on a day it was prayed. */
  rakahs: number | null;
  loggedAt: string;
};

/** "Prayed · 8 rak'ahs" */
export function describeDuha(entry: DuhaEntry): string {
  const label = DUHA_LABELS[entry.status];
  if (entry.status !== "prayed" || !entry.rakahs) return label;
  return `${label} · ${entry.rakahs} rak'ah${entry.rakahs === 1 ? "" : "s"}`;
}

export type DuhaSummary = {
  prayed: number;
  missed: number;
  logged: number;
  /** Rak'ahs across every day that recorded a count. */
  rakahs: number;
};

export function summariseDuha(entries: DuhaEntry[]): DuhaSummary {
  const summary: DuhaSummary = { prayed: 0, missed: 0, logged: 0, rakahs: 0 };
  for (const entry of entries) {
    summary.logged += 1;
    if (entry.status === "prayed") {
      summary.prayed += 1;
      if (entry.rakahs) summary.rakahs += entry.rakahs;
    } else {
      summary.missed += 1;
    }
  }
  return summary;
}
