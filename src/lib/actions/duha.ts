"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { duhaPrayers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import {
  isDuhaStatus,
  MAX_DUHA_RAKAHS,
  type DuhaEntry,
  type DuhaStatus,
} from "@/lib/duha";

export type DuhaResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One record per day. Re-recording overwrites, so a mis-tap is just re-tapped. */
export async function recordDuha(
  prayerDate: string,
  status: DuhaStatus,
  rakahs: number | null = null,
): Promise<DuhaResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isDuhaStatus(status)) {
    return { ok: false, error: "Unknown status." };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }

  // A rak'ah count only means something on a day it was actually prayed.
  const counting =
    status === "prayed" && Number.isInteger(rakahs) && (rakahs as number) >= 1;
  const stored = counting ? Math.min(MAX_DUHA_RAKAHS, rakahs as number) : null;

  try {
    await db
      .insert(duhaPrayers)
      .values({
        userId: user.id,
        prayerDate,
        status,
        rakahs: stored,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [duhaPrayers.userId, duhaPrayers.prayerDate],
        set: { status, rakahs: stored, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

export async function clearDuha(prayerDate: string): Promise<DuhaResult> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(duhaPrayers)
      .where(
        and(
          eq(duhaPrayers.userId, user.id),
          eq(duhaPrayers.prayerDate, prayerDate),
        ),
      );
    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

export async function readDuha(since: string): Promise<DuhaEntry[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: duhaPrayers.prayerDate,
      status: duhaPrayers.status,
      rakahs: duhaPrayers.rakahs,
      loggedAt: duhaPrayers.loggedAt,
    })
    .from(duhaPrayers)
    .where(
      and(eq(duhaPrayers.userId, user.id), gte(duhaPrayers.prayerDate, since)),
    )
    .orderBy(desc(duhaPrayers.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as DuhaStatus,
    rakahs: row.rakahs,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
