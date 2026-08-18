"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, gte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { quranLog } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import { isSurahNumber } from "@/lib/quran";

export type QuranResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SurahReading = { prayerDate: string; surah: number };

/**
 * Replaces the whole set of surahs read on one day.
 *
 * The picker always hands over the full set it is showing, so a write is a
 * reconciliation rather than an append: surahs no longer in the list are
 * removed, new ones added, and the ones already there keep the timestamp they
 * were first logged with.
 */
export async function setSurahs(
  prayerDate: string,
  surahs: number[],
): Promise<QuranResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }
  if (!Array.isArray(surahs)) {
    return { ok: false, error: "Couldn't read that selection." };
  }

  // The list arrives from the client, so anything outside 1–114 is dropped
  // rather than trusted, and duplicates collapse.
  const wanted = [...new Set(surahs.filter((value) => isSurahNumber(value)))].sort(
    (a, b) => a - b,
  );

  try {
    await db.transaction(async (tx) => {
      const mine = and(
        eq(quranLog.userId, user.id),
        eq(quranLog.prayerDate, prayerDate),
      );

      if (wanted.length === 0) {
        await tx.delete(quranLog).where(mine);
        return;
      }

      await tx
        .delete(quranLog)
        .where(and(mine, notInArray(quranLog.surah, wanted)));

      await tx
        .insert(quranLog)
        .values(
          wanted.map((surah) => ({
            userId: user.id,
            prayerDate,
            surah,
            loggedAt: new Date(),
          })),
        )
        .onConflictDoNothing({
          target: [quranLog.userId, quranLog.prayerDate, quranLog.surah],
        });
    });

    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Removes one surah from a day, for the small × on its chip. */
export async function removeSurah(
  prayerDate: string,
  surah: number,
): Promise<QuranResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate) || !isSurahNumber(surah)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(quranLog)
      .where(
        and(
          eq(quranLog.userId, user.id),
          eq(quranLog.prayerDate, prayerDate),
          eq(quranLog.surah, surah),
        ),
      );
    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

export async function readSurahs(since: string): Promise<SurahReading[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({ prayerDate: quranLog.prayerDate, surah: quranLog.surah })
    .from(quranLog)
    .where(and(eq(quranLog.userId, user.id), gte(quranLog.prayerDate, since)))
    .orderBy(asc(quranLog.surah));

  return rows;
}

/** Used by the day-clearing action so one tap wipes the whole day. */
export async function clearSurahDay(prayerDate: string): Promise<QuranResult> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }

  try {
    await db
      .delete(quranLog)
      .where(
        and(eq(quranLog.userId, user.id), eq(quranLog.prayerDate, prayerDate)),
      );
    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't clear that day. Please try again." };
  }
}
