"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { worshipLog } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { todayKeyInZone } from "@/lib/time";
import {
  isWorshipKind,
  MAX_WORSHIP_COUNT,
  MAX_WORSHIP_STEP,
  type WorshipKind,
  type WorshipRowValue,
} from "@/lib/worship";

export type WorshipResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Adds to (or subtracts from) a day's tally.
 *
 * The arithmetic happens in the database rather than read-modify-write in the
 * app, so a fast run of taps can't lose an increment to a race between two
 * in-flight requests. The result is the authoritative count afterwards.
 */
export async function bumpWorship(
  prayerDate: string,
  kind: WorshipKind,
  delta: number,
): Promise<WorshipResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isWorshipKind(kind)) {
    return { ok: false, error: "Unknown kind." };
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: "That amount doesn't look right." };
  }
  if (Math.abs(delta) > MAX_WORSHIP_STEP) {
    return { ok: false, error: `Add at most ${MAX_WORSHIP_STEP} at a time.` };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }

  const seed = Math.min(MAX_WORSHIP_COUNT, Math.max(0, delta));

  try {
    const [row] = await db
      .insert(worshipLog)
      .values({
        userId: user.id,
        prayerDate,
        kind,
        count: seed,
        loggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [worshipLog.userId, worshipLog.prayerDate, worshipLog.kind],
        set: {
          count: sql`least(${MAX_WORSHIP_COUNT}, greatest(0, ${worshipLog.count} + ${delta}))`,
          loggedAt: new Date(),
        },
      })
      .returning({ count: worshipLog.count });

    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true, count: row?.count ?? seed };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Types a number in directly, replacing whatever was there. */
export async function setWorship(
  prayerDate: string,
  kind: WorshipKind,
  value: number,
): Promise<WorshipResult> {
  const user = await requireUser();

  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }
  if (!isWorshipKind(kind)) {
    return { ok: false, error: "Unknown kind." };
  }
  if (!Number.isInteger(value) || value < 0 || value > MAX_WORSHIP_COUNT) {
    return {
      ok: false,
      error: `Enter a whole number from 0 to ${MAX_WORSHIP_COUNT.toLocaleString()}.`,
    };
  }
  if (prayerDate > todayKeyInZone(user.timezone)) {
    return { ok: false, error: "That day hasn't happened yet." };
  }

  try {
    if (value === 0) {
      await db
        .delete(worshipLog)
        .where(
          and(
            eq(worshipLog.userId, user.id),
            eq(worshipLog.prayerDate, prayerDate),
            eq(worshipLog.kind, kind),
          ),
        );
    } else {
      await db
        .insert(worshipLog)
        .values({
          userId: user.id,
          prayerDate,
          kind,
          count: value,
          loggedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [worshipLog.userId, worshipLog.prayerDate, worshipLog.kind],
          set: { count: value, loggedAt: new Date() },
        });
    }

    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true, count: value };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Wipes a whole day's worship tallies. */
export async function clearWorshipDay(
  prayerDate: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!DATE_RE.test(prayerDate)) {
    return { ok: false, error: "That date doesn't look right." };
  }

  try {
    await db
      .delete(worshipLog)
      .where(
        and(eq(worshipLog.userId, user.id), eq(worshipLog.prayerDate, prayerDate)),
      );
    revalidatePath("/");
    revalidatePath("/worship");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't clear that day. Please try again." };
  }
}

export async function readWorship(since: string): Promise<WorshipRowValue[]> {
  const user = await requireUser();
  if (!DATE_RE.test(since)) return [];

  const rows = await db
    .select({
      prayerDate: worshipLog.prayerDate,
      kind: worshipLog.kind,
      count: worshipLog.count,
    })
    .from(worshipLog)
    .where(and(eq(worshipLog.userId, user.id), gte(worshipLog.prayerDate, since)))
    .orderBy(desc(worshipLog.prayerDate));

  return rows.map((row) => ({
    prayerDate: row.prayerDate,
    kind: row.kind as WorshipKind,
    count: row.count,
  }));
}
