"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { sunnahLog } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isDailyPrayerKey, type DailyPrayerKey } from "@/lib/prayers";
import { todayKeyInZone } from "@/lib/time";
import type { SunnahEntry } from "@/lib/sunnah";

export type SunnahResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One record per prayer per day; re-recording overwrites it. */
export async function recordSunnah(
  prayerDate: string,
  prayer: DailyPrayerKey,
  prayed: boolean,
): Promise<SunnahResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isDailyPrayerKey(prayer)) {
    return { ok: false, error: "Unknown prayer." };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }

  try {
    await db
      .insert(sunnahLog)
      .values({
        userId: user.id,
        prayerDate,
        prayer,
        prayed: prayed === true,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [sunnahLog.userId, sunnahLog.prayerDate, sunnahLog.prayer],
        set: { prayed: prayed === true, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

export async function clearSunnah(
  prayerDate: string,
  prayer: DailyPrayerKey,
): Promise<SunnahResult> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate) || !isDailyPrayerKey(prayer)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(sunnahLog)
      .where(
        and(
          eq(sunnahLog.userId, user.id),
          eq(sunnahLog.prayerDate, prayerDate),
          eq(sunnahLog.prayer, prayer),
        ),
      );
    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

export async function readSunnah(since: string): Promise<SunnahEntry[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: sunnahLog.prayerDate,
      prayer: sunnahLog.prayer,
      prayed: sunnahLog.prayed,
      loggedAt: sunnahLog.loggedAt,
    })
    .from(sunnahLog)
    .where(and(eq(sunnahLog.userId, user.id), gte(sunnahLog.prayerDate, since)))
    .orderBy(desc(sunnahLog.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    prayed: row.prayed,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
