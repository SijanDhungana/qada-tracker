"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { masjidPrayers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isDailyPrayerKey, type DailyPrayerKey } from "@/lib/prayers";
import { todayKeyInZone } from "@/lib/time";
import {
  isMasjidStatus,
  MAX_REASON_LENGTH,
  type MasjidEntry,
  type MasjidStatus,
} from "@/lib/masjid";

export type MasjidResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Records where one prayer was prayed on one day. Re-recording the same
 * prayer overwrites it, so a mis-tap is corrected by tapping the right one —
 * there is nothing to undo and no duplicate rows to reconcile.
 */
export async function recordMasjidPrayer(input: {
  prayerDate: string;
  prayer: DailyPrayerKey;
  status: MasjidStatus;
  reason?: string | null;
}): Promise<MasjidResult> {
  const user = await requireUser();

  if (!DATE_RE.test(input.prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isDailyPrayerKey(input.prayer)) {
    return { ok: false, error: "Unknown prayer." };
  }
  if (!isMasjidStatus(input.status)) {
    return { ok: false, error: "Unknown status." };
  }
  // Past days are editable; days that haven't happened yet are not.
  if (input.prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }

  // A reason only means anything when the prayer wasn't at the masjid.
  const reason =
    input.status === "masjid"
      ? null
      : (input.reason ?? "").trim().slice(0, MAX_REASON_LENGTH) || null;

  try {
    await db
      .insert(masjidPrayers)
      .values({
        userId: user.id,
        prayerDate: input.prayerDate,
        prayer: input.prayer,
        status: input.status,
        reason,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          masjidPrayers.userId,
          masjidPrayers.prayerDate,
          masjidPrayers.prayer,
        ],
        set: { status: input.status, reason, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Clears a recorded prayer, returning it to "not logged yet". */
export async function clearMasjidPrayer(
  prayerDate: string,
  prayer: DailyPrayerKey,
): Promise<MasjidResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate) || !isDailyPrayerKey(prayer)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(masjidPrayers)
      .where(
        and(
          eq(masjidPrayers.userId, user.id),
          eq(masjidPrayers.prayerDate, prayerDate),
          eq(masjidPrayers.prayer, prayer),
        ),
      );
    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

/** Entries from `since` (a YYYY-MM-DD key) onwards, newest first. */
export async function readMasjidEntries(since: string): Promise<MasjidEntry[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: masjidPrayers.prayerDate,
      prayer: masjidPrayers.prayer,
      status: masjidPrayers.status,
      reason: masjidPrayers.reason,
      loggedAt: masjidPrayers.loggedAt,
    })
    .from(masjidPrayers)
    .where(
      and(eq(masjidPrayers.userId, user.id), gte(masjidPrayers.prayerDate, since)),
    )
    .orderBy(desc(masjidPrayers.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    status: row.status as MasjidStatus,
    reason: row.reason,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
