/**
 * Tonight's witr, as opposed to the witr slots in the qada ledger.
 *
 * Two answers rather than three: witr is prayed alone, so there is no
 * "at the masjid" middle case to record. Missing it is not the end of the
 * entry — witr can be made up, and the record says so.
 */
export const WITR_STATUSES = ["prayed", "missed"] as const;
export type WitrStatus = (typeof WITR_STATUSES)[number];

export function isWitrStatus(value: unknown): value is WitrStatus {
  return (
    typeof value === "string" && (WITR_STATUSES as readonly string[]).includes(value)
  );
}

export const WITR_LABELS: Record<WitrStatus, string> = {
  prayed: "Prayed",
  missed: "Missed",
};

export type WitrEntry = {
  prayerDate: string;
  status: WitrStatus;
  /** Missed at its time, then prayed later. Only meaningful when missed. */
  remade: boolean;
  loggedAt: string;
};

/** "Prayed" / "Missed" / "Missed, made up" */
export function describeWitr(entry: WitrEntry): string {
  if (entry.status === "prayed") return WITR_LABELS.prayed;
  return entry.remade ? "Missed, made up" : WITR_LABELS.missed;
}

export type WitrSummary = { prayed: number; remade: number; missed: number; logged: number };

export function summariseWitr(entries: WitrEntry[]): WitrSummary {
  const summary: WitrSummary = { prayed: 0, remade: 0, missed: 0, logged: 0 };
  for (const entry of entries) {
    summary.logged += 1;
    if (entry.status === "prayed") summary.prayed += 1;
    else if (entry.remade) summary.remade += 1;
    else summary.missed += 1;
  }
  return summary;
}
