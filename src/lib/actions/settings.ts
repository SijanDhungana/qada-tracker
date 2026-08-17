"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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

export async function setTrackTahajjud(value: boolean): Promise<SettingsResult> {
  const user = await requireUser();
  try {
    await db
      .update(users)
      .set({ trackTahajjud: value })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/masjid");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Turning the rak'ah question off leaves the counts already recorded alone —
 * they simply stop being shown, and come back if it's turned on again.
 */
export async function setTrackTahajjudRakahs(
  value: boolean,
): Promise<SettingsResult> {
  const user = await requireUser();
  try {
    await db
      .update(users)
      .set({ trackTahajjudRakahs: value })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/masjid");
  revalidatePath("/settings");
  return { ok: true };
}

export async function setTrackSunnah(value: boolean): Promise<SettingsResult> {
  const user = await requireUser();
  try {
    await db.update(users).set({ trackSunnah: value }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }
  revalidatePath("/");
  revalidatePath("/masjid");
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

export type RemoveDirection = "recent" | "oldest";

function orderForDirection(direction: RemoveDirection) {
  // "Recent" targets the highest day_index — the days added last, which are
  // the ones least likely to already have anything logged against them.
  return direction === "recent" ? desc(prayerDays.dayIndex) : asc(prayerDays.dayIndex);
}

/**
 * What removing N days by count would destroy. Works uniformly for dated and
 * quick-amount days — count-based removal is the only way to remove a
 * quick-amount day at all, since those have no date to filter by.
 */
export async function previewRemovalByCount(
  amount: number,
  direction: RemoveDirection,
): Promise<{ ok: true; days: number; logged: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const n = Math.trunc(amount);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: "Enter a whole number of 1 or more." };
  }

  try {
    const [totalRow] = await db
      .select({ total: count() })
      .from(prayerDays)
      .where(eq(prayerDays.userId, user.id));
    const total = totalRow?.total ?? 0;

    if (n > total) {
      return {
        ok: false,
        error: `You only have ${total.toLocaleString()} ${total === 1 ? "day" : "days"} tracked.`,
      };
    }

    const rows = await db
      .select({
        fajr: prayerDays.fajr,
        zuhr: prayerDays.zuhr,
        asr: prayerDays.asr,
        maghrib: prayerDays.maghrib,
        isha: prayerDays.isha,
        witr: prayerDays.witr,
      })
      .from(prayerDays)
      .where(eq(prayerDays.userId, user.id))
      .orderBy(orderForDirection(direction))
      .limit(n);

    const logged = rows.reduce(
      (sum, row) =>
        sum +
        [row.fajr, row.zuhr, row.asr, row.maghrib, row.isha, row.witr].filter(Boolean)
          .length,
      0,
    );

    return { ok: true, days: n, logged };
  } catch {
    return { ok: false, error: "Couldn't check that. Please try again." };
  }
}

/** Removes the N most-recently-added (or oldest) days, then renumbers what's left. */
export async function removeDaysByCount(
  amount: number,
  direction: RemoveDirection,
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const n = Math.trunc(amount);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: "Enter a whole number of 1 or more." };
  }

  try {
    let removed = 0;

    await db.transaction(async (tx) => {
      const targets = await tx
        .select({ id: prayerDays.id })
        .from(prayerDays)
        .where(eq(prayerDays.userId, user.id))
        .orderBy(orderForDirection(direction))
        .limit(n);

      if (targets.length === 0) return;

      await tx.delete(prayerDays).where(
        inArray(
          prayerDays.id,
          targets.map((t) => t.id),
        ),
      );
      removed = targets.length;

      await tx.execute(sql`
        with renumbered as (
          select id, row_number() over (order by day_index) as position
          from ${prayerDays} where user_id = ${user.id}
        )
        update ${prayerDays} d
        set day_index = renumbered.position
        from renumbered
        where d.id = renumbered.id and d.day_index <> renumbered.position
      `);
    });

    revalidatePath("/");
    revalidatePath("/ledger");
    revalidatePath("/settings");
    return { ok: true, removed };
  } catch {
    return { ok: false, error: "Couldn't remove those days. Please try again." };
  }
}

/** How many prayers a reset would clear — shown before the user confirms it. */
export async function previewReset(): Promise<
  { ok: true; completed: number } | { ok: false; error: string }
> {
  const user = await requireUser();
  const doneExpr = user.trackWitr
    ? sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int`
    : sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int`;

  try {
    const [row] = await db
      .select({ completed: sql<number>`coalesce(sum(${doneExpr}), 0)::int` })
      .from(prayerDays)
      .where(eq(prayerDays.userId, user.id));
    return { ok: true, completed: row?.completed ?? 0 };
  } catch {
    return { ok: false, error: "Couldn't check your progress. Please try again." };
  }
}

/**
 * Unchecks every prayer for this account, including hidden Witr slots, but
 * keeps every day row — the backlog size and its dates are untouched. This is
 * "start counting again from zero," not "delete my days."
 */
export async function resetProgress(): Promise<
  { ok: true; cleared: number } | { ok: false; error: string }
> {
  const user = await requireUser();
  // Same expression previewReset used, so the number shown before confirming
  // matches the number reported after — witr only counts when it's tracked.
  const doneExpr = user.trackWitr
    ? sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int`
    : sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int`;

  try {
    let cleared = 0;

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ completed: sql<number>`coalesce(sum(${doneExpr}), 0)::int` })
        .from(prayerDays)
        .where(eq(prayerDays.userId, user.id));
      cleared = row?.completed ?? 0;

      await tx
        .update(prayerDays)
        .set({
          fajr: false,
          zuhr: false,
          asr: false,
          maghrib: false,
          isha: false,
          witr: false,
          fajrAt: null,
          zuhrAt: null,
          asrAt: null,
          maghribAt: null,
          ishaAt: null,
          witrAt: null,
        })
        .where(eq(prayerDays.userId, user.id));
    });

    revalidatePath("/");
    revalidatePath("/ledger");
    revalidatePath("/settings");
    return { ok: true, cleared };
  } catch {
    return { ok: false, error: "Couldn't reset your progress. Please try again." };
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
