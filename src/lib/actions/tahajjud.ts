"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { tahajjudNights } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import {
  isTahajjudStatus,
  MAX_TAHAJJUD_RAKAHS,
  type TahajjudEntry,
  type TahajjudStatus,
} from "@/lib/tahajjud";

export type TahajjudResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One record per night. Re-recording overwrites, so a mis-tap is just re-tapped. */
export async function recordTahajjud(
  prayerDate: string,
  status: TahajjudStatus,
  rakahs: number | null = null,
): Promise<TahajjudResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isTahajjudStatus(status)) {
    return { ok: false, error: "Unknown status." };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That night hasn't happened yet." };
  }

  // A rak'ah count only means something on a night that was actually prayed,
  // and only for the users who asked to be asked.
  const counting =
    status === "prayed" &&
    user.trackTahajjudRakahs &&
    Number.isInteger(rakahs) &&
    (rakahs as number) >= 1;
  const stored = counting ? Math.min(MAX_TAHAJJUD_RAKAHS, rakahs as number) : null;

  try {
    await db
      .insert(tahajjudNights)
      .values({
        userId: user.id,
        prayerDate,
        status,
        rakahs: stored,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tahajjudNights.userId, tahajjudNights.prayerDate],
        set: { status, rakahs: stored, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

export async function clearTahajjud(prayerDate: string): Promise<TahajjudResult> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(tahajjudNights)
      .where(
        and(
          eq(tahajjudNights.userId, user.id),
          eq(tahajjudNights.prayerDate, prayerDate),
        ),
      );
    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

export async function readTahajjud(since: string): Promise<TahajjudEntry[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: tahajjudNights.prayerDate,
      status: tahajjudNights.status,
      rakahs: tahajjudNights.rakahs,
      loggedAt: tahajjudNights.loggedAt,
    })
    .from(tahajjudNights)
    .where(
      and(
        eq(tahajjudNights.userId, user.id),
        gte(tahajjudNights.prayerDate, since),
      ),
    )
    .orderBy(desc(tahajjudNights.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as TahajjudStatus,
    rakahs: row.rakahs,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
