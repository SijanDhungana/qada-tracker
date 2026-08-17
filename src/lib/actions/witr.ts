"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { dailyWitr } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import { isWitrStatus, type WitrEntry, type WitrStatus } from "@/lib/witr";

export type WitrResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One record per night. Re-recording overwrites, so a mis-tap is just re-tapped.
 * "Made up" only survives on a missed night — praying it on time leaves nothing
 * to make up.
 */
export async function recordWitr(
  prayerDate: string,
  status: WitrStatus,
  remade = false,
): Promise<WitrResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isWitrStatus(status)) {
    return { ok: false, error: "Unknown status." };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That night hasn't happened yet." };
  }

  const madeUp = status === "missed" && remade === true;

  try {
    await db
      .insert(dailyWitr)
      .values({
        userId: user.id,
        prayerDate,
        status,
        remade: madeUp,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [dailyWitr.userId, dailyWitr.prayerDate],
        set: { status, remade: madeUp, loggedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

export async function clearWitr(prayerDate: string): Promise<WitrResult> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "Couldn't find that entry." };
  }

  try {
    await db
      .delete(dailyWitr)
      .where(and(eq(dailyWitr.userId, user.id), eq(dailyWitr.prayerDate, prayerDate)));
    revalidatePath("/");
    revalidatePath("/masjid");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that. Please try again." };
  }
}

export async function readWitr(since: string): Promise<WitrEntry[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: dailyWitr.prayerDate,
      status: dailyWitr.status,
      remade: dailyWitr.remade,
      loggedAt: dailyWitr.loggedAt,
    })
    .from(dailyWitr)
    .where(and(eq(dailyWitr.userId, user.id), gte(dailyWitr.prayerDate, since)))
    .orderBy(desc(dailyWitr.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as WitrStatus,
    remade: row.remade,
    loggedAt: row.loggedAt.toISOString(),
  }));
}
