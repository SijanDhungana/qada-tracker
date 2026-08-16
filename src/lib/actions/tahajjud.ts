"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { tahajjudNights } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import {
  isTahajjudStatus,
  type TahajjudEntry,
  type TahajjudStatus,
} from "@/lib/tahajjud";

export type TahajjudResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One record per night. Re-recording overwrites, so a mis-tap is just re-tapped. */
export async function recordTahajjud(
  prayerDate: string,
  status: TahajjudStatus,
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

  try {
    await db
      .insert(tahajjudNights)
      .values({ userId: user.id, prayerDate, status, loggedAt: new Date() })
      .onConflictDoUpdate({
        target: [tahajjudNights.userId, tahajjudNights.prayerDate],
        set: { status, loggedAt: new Date() },
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
    loggedAt: row.loggedAt.toISOString(),
  }));
}
