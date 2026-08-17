"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { sunnahLog } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isDailyPrayerKey, type DailyPrayerKey } from "@/lib/prayers";
import { todayKeyInZone } from "@/lib/time";
import {
  isSunnahPart,
  partsFor,
  type PartAnswers,
  type SunnahEntry,
  type SunnahPart,
} from "@/lib/sunnah";

export type SunnahResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One record per part per prayer per day; re-recording overwrites it. */
export async function recordSunnah(
  prayerDate: string,
  prayer: DailyPrayerKey,
  part: SunnahPart,
  prayed: boolean,
): Promise<SunnahResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isDailyPrayerKey(prayer)) {
    return { ok: false, error: "Unknown prayer." };
  }
  if (!isSunnahPart(part) || !partsFor(prayer).some((spec) => spec.part === part)) {
    return { ok: false, error: "That prayer has no such sunnah." };
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
        part,
        prayed: prayed === true,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          sunnahLog.userId,
          sunnahLog.prayerDate,
          sunnahLog.prayer,
          sunnahLog.part,
        ],
        set: { prayed: prayed === true, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/**
 * Writes every part of one prayer at once.
 *
 * The prayer sheet stages its answers and commits them together, so this takes
 * the whole set: a part answered becomes a row, a part left blank loses its
 * row. Doing it in one transaction means a half-saved prayer is not a state
 * the screen can end up in.
 */
export async function saveSunnahParts(
  prayerDate: string,
  prayer: DailyPrayerKey,
  answers: PartAnswers,
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

  // Only parts this prayer actually has; anything else is ignored rather than
  // trusted, since the answers arrive from the client.
  const known = partsFor(prayer).map((spec) => spec.part);
  const setParts = known.filter((part) => typeof answers[part] === "boolean");
  const clearParts = known.filter((part) => typeof answers[part] !== "boolean");

  try {
    await db.transaction(async (tx) => {
      if (setParts.length > 0) {
        await tx
          .insert(sunnahLog)
          .values(
            setParts.map((part) => ({
              userId: user.id,
              prayerDate,
              prayer,
              part,
              prayed: answers[part] === true,
              loggedAt: new Date(),
            })),
          )
          .onConflictDoUpdate({
            target: [
              sunnahLog.userId,
              sunnahLog.prayerDate,
              sunnahLog.prayer,
              sunnahLog.part,
            ],
            set: {
              prayed: sql`excluded.prayed`,
              loggedAt: new Date(),
            },
          });
      }

      if (clearParts.length > 0) {
        await tx
          .delete(sunnahLog)
          .where(
            and(
              eq(sunnahLog.userId, user.id),
              eq(sunnahLog.prayerDate, prayerDate),
              eq(sunnahLog.prayer, prayer),
              inArray(sunnahLog.part, clearParts),
            ),
          );
      }
    });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Clears every part recorded for one prayer on one day. */
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
      part: sunnahLog.part,
      prayed: sunnahLog.prayed,
      loggedAt: sunnahLog.loggedAt,
    })
    .from(sunnahLog)
    .where(and(eq(sunnahLog.userId, user.id), gte(sunnahLog.prayerDate, since)))
    .orderBy(desc(sunnahLog.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    part: row.part as SunnahPart,
    prayed: row.prayed,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
