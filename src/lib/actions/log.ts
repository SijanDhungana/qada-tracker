"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isPrayerKey, type PrayerKey } from "@/lib/prayers";

export type LoggedSlot = {
  dayId: string;
  dayIndex: number;
  dayDate: string | null;
  prayer: PrayerKey;
};

export type LogResult =
  | { ok: true; logged: LoggedSlot[] }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

const MAX_BATCH = 50;

/**
 * Column names are derived from a validated PrayerKey, never from raw input,
 * so interpolating them as identifiers is safe.
 */
function columns(prayer: PrayerKey) {
  return { flag: sql.raw(`"${prayer}"`), at: sql.raw(`"${prayer}_at"`) };
}

/**
 * Marks the N oldest incomplete slots of one prayer as logged, stamping each
 * with the moment it was pressed.
 *
 * The target is recomputed from the table on every call rather than cached, so
 * manually clearing a day in the middle of the ledger can never leave the
 * pointer stale. `AND flag = false` inside the update also makes two
 * simultaneous taps safe: the loser updates nothing instead of silently
 * overwriting the winner's row.
 */
export async function logPrayer(
  prayer: PrayerKey,
  count = 1,
): Promise<LogResult> {
  const user = await requireUser();

  if (!isPrayerKey(prayer)) return { ok: false, error: "Unknown prayer." };
  if (prayer === "witr" && !user.trackWitr) {
    return { ok: false, error: "Witr tracking is turned off." };
  }

  const wanted = Math.min(Math.max(Math.trunc(count) || 1, 1), MAX_BATCH);
  const { flag, at } = columns(prayer);

  try {
    const rows = await db.execute<{
      id: string;
      day_index: number;
      day_date: string | null;
    }>(sql`
      update ${prayerDays} set ${flag} = true, ${at} = now()
      where id in (
        select id from ${prayerDays}
        where user_id = ${user.id} and ${flag} = false
        order by day_index asc
        limit ${wanted}
      )
      and ${flag} = false
      returning id, day_index, day_date
    `);

    const logged = Array.from(rows).map((row) => ({
      dayId: row.id,
      dayIndex: row.day_index,
      dayDate: row.day_date,
      prayer,
    }));

    if (logged.length === 0) {
      return { ok: false, error: "Nothing left to log for that prayer." };
    }

    revalidatePath("/");
    revalidatePath("/ledger");
    return { ok: true, logged };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/**
 * Undoes the most recently logged slot of one prayer. `since` is the start of
 * the user's local day as an ISO instant — the browser knows its own timezone,
 * so the boundary is computed there and the server just honours it.
 */
export async function unlogLatest(
  prayer: PrayerKey,
  since: string,
): Promise<LogResult> {
  const user = await requireUser();

  if (!isPrayerKey(prayer)) return { ok: false, error: "Unknown prayer." };

  const boundary = new Date(since);
  if (Number.isNaN(boundary.getTime())) {
    return { ok: false, error: "Couldn't work out today's date." };
  }

  const { flag, at } = columns(prayer);

  try {
    const rows = await db.execute<{
      id: string;
      day_index: number;
      day_date: string | null;
    }>(sql`
      update ${prayerDays} set ${flag} = false, ${at} = null
      where id = (
        select id from ${prayerDays}
        where user_id = ${user.id} and ${flag} = true and ${at} >= ${boundary.toISOString()}
        -- A batch writes now() once for the whole transaction, so every row in
        -- it shares a timestamp. Falling back to the highest day_index takes
        -- back the one filled last instead of an arbitrary member of the batch.
        order by ${at} desc, day_index desc
        limit 1
      )
      returning id, day_index, day_date
    `);

    const undone = Array.from(rows).map((row) => ({
      dayId: row.id,
      dayIndex: row.day_index,
      dayDate: row.day_date,
      prayer,
    }));

    if (undone.length === 0) {
      return { ok: false, error: "Nothing logged today to undo." };
    }

    revalidatePath("/");
    revalidatePath("/ledger");
    return { ok: true, logged: undone };
  } catch {
    return { ok: false, error: "Couldn't save that. Check your connection." };
  }
}

/** Undo a specific slot — what the toast's Undo action calls. */
export async function undoSlot(
  dayId: string,
  prayer: PrayerKey,
): Promise<SimpleResult> {
  const user = await requireUser();
  if (!isPrayerKey(prayer)) return { ok: false, error: "Unknown prayer." };

  const { flag, at } = columns(prayer);

  try {
    await db.execute(sql`
      update ${prayerDays} set ${flag} = false, ${at} = null
      where id = ${dayId} and user_id = ${user.id}
    `);
    revalidatePath("/");
    revalidatePath("/ledger");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't undo that. Please try again." };
  }
}

/** Set or clear one slot on one specific day — the ledger's manual path. */
export async function setSlot(
  dayId: string,
  prayer: PrayerKey,
  value: boolean,
): Promise<SimpleResult> {
  const user = await requireUser();

  if (!isPrayerKey(prayer)) return { ok: false, error: "Unknown prayer." };
  if (prayer === "witr" && !user.trackWitr && value) {
    return { ok: false, error: "Witr tracking is turned off." };
  }

  const { flag, at } = columns(prayer);

  try {
    const rows = await db.execute<{ id: string }>(sql`
      update ${prayerDays}
      set ${flag} = ${value}, ${at} = ${value ? sql`now()` : sql`null`}
      where id = ${dayId} and user_id = ${user.id}
      returning id
    `);

    if (Array.from(rows).length === 0) {
      return { ok: false, error: "That day is no longer available." };
    }

    revalidatePath("/");
    revalidatePath("/ledger");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save. Check your connection and retry." };
  }
}

/** Fill every counting slot on a day, or clear the whole day back to empty. */
export async function setWholeDay(
  dayId: string,
  value: boolean,
): Promise<SimpleResult> {
  const user = await requireUser();

  try {
    const updated = await db
      .update(prayerDays)
      .set({
        fajr: value,
        zuhr: value,
        asr: value,
        maghrib: value,
        isha: value,
        fajrAt: value ? new Date() : null,
        zuhrAt: value ? new Date() : null,
        asrAt: value ? new Date() : null,
        maghribAt: value ? new Date() : null,
        ishaAt: value ? new Date() : null,
        // Leave Witr alone when it isn't being tracked.
        ...(user.trackWitr
          ? { witr: value, witrAt: value ? new Date() : null }
          : {}),
      })
      .where(and(eq(prayerDays.id, dayId), eq(prayerDays.userId, user.id)))
      .returning({ id: prayerDays.id });

    if (updated.length === 0) {
      return { ok: false, error: "That day is no longer available." };
    }

    revalidatePath("/");
    revalidatePath("/ledger");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save. Check your connection and retry." };
  }
}
