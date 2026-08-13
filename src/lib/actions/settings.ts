"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays, users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { clampGoal } from "@/lib/projection";
import { isValidTimezone } from "@/lib/time";
import {
  daysFromAmount,
  daysFromDateRange,
  isUnit,
  type NewDay,
} from "@/lib/days";

export type SettingsResult = { ok: true } | { ok: false; error: string };
export type AddResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: string };

const INSERT_CHUNK_SIZE = 500;

/**
 * Turning Witr off only hides it — the stored checkmarks stay put so turning
 * it back on restores exactly what was there.
 */
export async function setTrackWitr(value: boolean): Promise<SettingsResult> {
  const user = await requireUser();
  try {
    await db.update(users).set({ trackWitr: value }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/ledger");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setDailyGoal(value: number): Promise<SettingsResult> {
  const user = await requireUser();
  try {
    await db
      .update(users)
      .set({ dailyGoal: clampGoal(value) })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save your goal. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setTimezone(value: string): Promise<SettingsResult> {
  const user = await requireUser();
  if (!isValidTimezone(value)) {
    return { ok: false, error: "That doesn't look like a valid timezone." };
  }
  try {
    await db.update(users).set({ timezone: value }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/masjid");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setTheme(value: string): Promise<SettingsResult> {
  const user = await requireUser();
  const theme = ["system", "dark", "light"].includes(value) ? value : "system";
  try {
    await db.update(users).set({ theme }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Appends missed days. Dated days that are already tracked are skipped rather
 * than duplicated, so re-entering an overlapping range is harmless.
 */
export async function addMissedDays(input: {
  mode: "range" | "amount";
  startDate?: string;
  endDate?: string;
  amount?: number;
  unit?: string;
}): Promise<AddResult> {
  const user = await requireUser();

  let parsed;
  if (input.mode === "range") {
    parsed = daysFromDateRange(input.startDate ?? "", input.endDate ?? "");
  } else if (input.mode === "amount") {
    if (!isUnit(input.unit)) {
      return { ok: false, error: "Please choose days, weeks or months." };
    }
    parsed = daysFromAmount(Number(input.amount), input.unit);
  } else {
    return { ok: false, error: "Please choose how you'd like to enter your days." };
  }

  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.days.length === 0) {
    return { ok: false, error: "That works out to zero days." };
  }

  try {
    let added = 0;
    let skipped = 0;

    await db.transaction(async (tx) => {
      const existingDated = await tx
        .select({ dayDate: prayerDays.dayDate })
        .from(prayerDays)
        .where(eq(prayerDays.userId, user.id));

      const taken = new Set(
        existingDated.map((row) => row.dayDate).filter((d): d is string => Boolean(d)),
      );

      const fresh: NewDay[] = [];
      for (const day of parsed.days) {
        if (day.dayDate && taken.has(day.dayDate)) {
          skipped += 1;
          continue;
        }
        if (day.dayDate) taken.add(day.dayDate);
        fresh.push(day);
      }

      const [row] = await tx
        .select({ highest: sql<number>`coalesce(max(day_index), 0)::int` })
        .from(prayerDays)
        .where(eq(prayerDays.userId, user.id));

      let nextIndex = (row?.highest ?? 0) + 1;

      for (let i = 0; i < fresh.length; i += INSERT_CHUNK_SIZE) {
        const chunk = fresh.slice(i, i + INSERT_CHUNK_SIZE).map((day) => ({
          userId: user.id,
          dayIndex: nextIndex++,
          dayDate: day.dayDate,
        }));
        if (chunk.length > 0) await tx.insert(prayerDays).values(chunk);
      }

      added = fresh.length;
    });

    revalidatePath("/");
    revalidatePath("/ledger");
    revalidatePath("/settings");
    return { ok: true, added, skipped };
  } catch {
    return { ok: false, error: "Couldn't save those days. Please try again." };
  }
}

/** What a removal would destroy — shown in the confirmation before it happens. */
export async function previewRemoval(
  startDate: string,
  endDate: string,
): Promise<
  { ok: true; days: number; logged: number } | { ok: false; error: string }
> {
  const user = await requireUser();
  const parsed = daysFromDateRange(startDate, endDate);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const [row] = await db
      .select({
        days: sql<number>`count(*)::int`,
        logged: sql<number>`coalesce(sum(
          fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int
        ), 0)::int`,
      })
      .from(prayerDays)
      .where(
        and(
          eq(prayerDays.userId, user.id),
          gte(prayerDays.dayDate, startDate),
          lte(prayerDays.dayDate, endDate),
        ),
      );

    return { ok: true, days: row?.days ?? 0, logged: row?.logged ?? 0 };
  } catch {
    return { ok: false, error: "Couldn't check that range. Please try again." };
  }
}

/**
 * Removes tracked days in a date range. Day indexes are renumbered afterwards
 * so the ledger stays contiguous and FIFO ordering is unaffected.
 */
export async function removeDays(
  startDate: string,
  endDate: string,
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = daysFromDateRange(startDate, endDate);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const removed = await db
      .delete(prayerDays)
      .where(
        and(
          eq(prayerDays.userId, user.id),
          gte(prayerDays.dayDate, startDate),
          lte(prayerDays.dayDate, endDate),
        ),
      )
      .returning({ id: prayerDays.id });

    await db.execute(sql`
      with renumbered as (
        select id, row_number() over (order by day_index) as position
        from ${prayerDays} where user_id = ${user.id}
      )
      update ${prayerDays} d
      set day_index = renumbered.position
      from renumbered
      where d.id = renumbered.id and d.day_index <> renumbered.position
    `);

    revalidatePath("/");
    revalidatePath("/ledger");
    revalidatePath("/settings");
    return { ok: true, removed: removed.length };
  } catch {
    return { ok: false, error: "Couldn't remove those days. Please try again." };
  }
}

export async function countDays(): Promise<number> {
  const user = await requireUser();
  const [row] = await db
    .select({ total: count() })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));
  return row?.total ?? 0;
}
