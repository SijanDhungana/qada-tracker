import type { DailyPrayerKey } from "./prayers";

/**
 * Where a prayer was prayed. Deliberately three states rather than a
 * yes/no — "prayed on my own" is a real and common answer, and collapsing it
 * into "missed" would make the record useless and the tone punitive.
 */
export const MASJID_STATUSES = ["masjid", "alone", "missed"] as const;
export type MasjidStatus = (typeof MASJID_STATUSES)[number];

export function isMasjidStatus(value: unknown): value is MasjidStatus {
  return (
    typeof value === "string" && (MASJID_STATUSES as readonly string[]).includes(value)
  );
}

export const STATUS_LABELS: Record<MasjidStatus, string> = {
  masjid: "At the masjid",
  alone: "On my own",
  missed: "Missed",
};

export const STATUS_SHORT: Record<MasjidStatus, string> = {
  masjid: "Masjid",
  alone: "On my own",
  missed: "Missed",
};

/**
 * Suggested notes. Plain descriptions of circumstances, never judgements —
 * the point is to notice patterns, not to keep a record of failures.
 */
export const REASON_SUGGESTIONS = [
  "Work",
  "Travelling",
  "Studying",
  "Unwell",
  "Asleep",
  "Family",
  "Weather",
  "Too far",
] as const;

export const MAX_REASON_LENGTH = 120;

/**
 * Whether the jama'ah was caught from the start. Only meaningful alongside
 * status "masjid" — praying alone or missing it has no timing to record.
 */
export const MASJID_TIMINGS = ["on_time", "late"] as const;
export type MasjidTiming = (typeof MASJID_TIMINGS)[number];

export function isMasjidTiming(value: unknown): value is MasjidTiming {
  return (
    typeof value === "string" && (MASJID_TIMINGS as readonly string[]).includes(value)
  );
}

export const TIMING_LABELS: Record<MasjidTiming, string> = {
  on_time: "On time",
  late: "Late",
};

/** Rak'ahs in each fard prayer, which bounds the "where did you join" options. */
export const RAKAH_COUNT: Record<DailyPrayerKey, number> = {
  fajr: 2,
  zuhr: 4,
  asr: 4,
  maghrib: 3,
  isha: 4,
};

/** Caught the final sitting but no full rak'ah with the imam. */
export const TASHAHHUD = "tashahhud";

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

export function rakahOptions(
  prayer: DailyPrayerKey,
): { value: string; label: string }[] {
  const options = Array.from({ length: RAKAH_COUNT[prayer] }, (_, index) => ({
    value: `rakah-${index + 1}`,
    label: ORDINALS[index],
  }));
  return [...options, { value: TASHAHHUD, label: "Last sitting" }];
}

export function isRakahValue(value: unknown, prayer: DailyPrayerKey): boolean {
  return (
    typeof value === "string" &&
    rakahOptions(prayer).some((option) => option.value === value)
  );
}

/** "joined at the 3rd rak'ah" / "caught the last sitting" */
export function describeRakah(value: string | null): string | null {
  if (!value) return null;
  if (value === TASHAHHUD) return "caught the last sitting";
  const match = /^rakah-(\d)$/.exec(value);
  if (!match) return null;
  const ordinal = ORDINALS[Number(match[1]) - 1] ?? `${match[1]}th`;
  return `joined at the ${ordinal} rak'ah`;
}

export type MasjidEntry = {
  prayerDate: string;
  prayer: DailyPrayerKey;
  status: MasjidStatus;
  timing: MasjidTiming | null;
  joinedRakah: string | null;
  reason: string | null;
  loggedAt: string;
};


export type MasjidSummary = {
  /** Prayers recorded as prayed at the masjid. */
  masjid: number;
  alone: number;
  missed: number;
  logged: number;
  /** Of the masjid ones, how many caught the jama'ah from the start. */
  onTime: number;
  late: number;
};

export function summarise(entries: MasjidEntry[]): MasjidSummary {
  const summary: MasjidSummary = {
    masjid: 0,
    alone: 0,
    missed: 0,
    logged: 0,
    onTime: 0,
    late: 0,
  };
  for (const entry of entries) {
    summary[entry.status] += 1;
    summary.logged += 1;
    if (entry.status === "masjid" && entry.timing === "on_time") summary.onTime += 1;
    if (entry.status === "masjid" && entry.timing === "late") summary.late += 1;
  }
  return summary;
}

/**
 * The most common notes attached to prayers that weren't at the masjid.
 * This is the actual payoff of asking for a reason — it turns a pile of
 * individual entries into something the user can act on.
 */
export function topReasons(
  entries: MasjidEntry[],
  limit = 4,
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === "masjid") continue;
    const reason = entry.reason?.trim();
    if (!reason) continue;
    const key = reason.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      // Restore the casing the user actually typed for the first occurrence.
      reason:
        entries.find((e) => e.reason?.trim().toLowerCase() === key)?.reason?.trim() ??
        key,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit);
}

/** Which of the five prayers most often happens away from the masjid. */
export function hardestPrayer(
  entries: MasjidEntry[],
): { prayer: DailyPrayerKey; away: number; total: number } | null {
  const tally = new Map<DailyPrayerKey, { away: number; total: number }>();

  for (const entry of entries) {
    const current = tally.get(entry.prayer) ?? { away: 0, total: 0 };
    current.total += 1;
    if (entry.status !== "masjid") current.away += 1;
    tally.set(entry.prayer, current);
  }

  let worst: { prayer: DailyPrayerKey; away: number; total: number } | null = null;
  for (const [prayer, counts] of tally) {
    if (counts.away === 0) continue;
    if (!worst || counts.away > worst.away) {
      worst = { prayer, away: counts.away, total: counts.total };
    }
  }
  return worst;
}

/** Monotonic, never-resetting counts — no streak to break. */
export function daysWithAnyMasjid(entries: MasjidEntry[]): number {
  const days = new Set<string>();
  for (const entry of entries) {
    if (entry.status === "masjid") days.add(entry.prayerDate);
  }
  return days.size;
}
