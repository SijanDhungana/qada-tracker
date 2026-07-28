"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays, users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isPrayerKey, type PrayerKey } from "@/lib/prayers";
import {
  daysFromAmount,
  daysFromDateRange,
  isUnit,
  type NewDay,
} from "@/lib/days";

export type ActionResult = { ok: true } | { ok: false; error: string };

const INSERT_CHUNK_SIZE = 500;

async function insertDays(userId: string, days: NewDay[]) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ highest: max(prayerDays.dayIndex) })
      .from(prayerDays)
      .where(eq(prayerDays.userId, userId));

    let nextIndex = (row?.highest ?? 0) + 1;

    for (let i = 0; i < days.length; i += INSERT_CHUNK_SIZE) {
      const chunk = days.slice(i, i + INSERT_CHUNK_SIZE).map((day) => ({
        userId,
        dayIndex: nextIndex++,
        dayDate: day.dayDate,
      }));
      await tx.insert(prayerDays).values(chunk);
    }
  });
}

/**
 * Adds missed days from either onboarding input. Used by /onboarding and by
 * Settings → "Add more missed days".
 */
export async function addMissedDays(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const mode = formData.get("mode");

  let parsed;
  if (mode === "range") {
    parsed = daysFromDateRange(
      String(formData.get("startDate") ?? ""),
      String(formData.get("endDate") ?? ""),
    );
  } else if (mode === "amount") {
    const unit = formData.get("unit");
    if (!isUnit(unit)) {
      return { ok: false, error: "Please choose days, weeks or months." };
    }
    parsed = daysFromAmount(Number(formData.get("amount")), unit);
  } else {
    return { ok: false, error: "Please choose how you'd like to enter your missed days." };
  }

  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.days.length === 0) {
    return { ok: false, error: "That works out to zero days." };
  }

  try {
    await insertDays(user.id, parsed.days);
  } catch {
    return { ok: false, error: "Couldn't save those days. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

/** Check or uncheck one prayer on one day. */
export async function setPrayer(
  dayId: string,
  prayer: PrayerKey,
  value: boolean,
): Promise<ActionResult> {
  const user = await requireUser();

  if (!isPrayerKey(prayer)) {
    return { ok: false, error: "Unknown prayer." };
  }
  if (prayer === "witr" && !user.trackWitr) {
    return { ok: false, error: "Witr tracking is turned off." };
  }

  try {
    const updated = await db
      .update(prayerDays)
      .set({ [prayer]: value })
      // Scoped to the session's user id — a day id alone is never enough.
      .where(and(eq(prayerDays.id, dayId), eq(prayerDays.userId, user.id)))
      .returning({ id: prayerDays.id });

    if (updated.length === 0) {
      return { ok: false, error: "That day is no longer available." };
    }
  } catch {
    return { ok: false, error: "Couldn't save. Check your connection and retry." };
  }

  return { ok: true };
}

/** Check off every prayer that counts for this user, on one day. */
export async function markDayDone(dayId: string): Promise<ActionResult> {
  const user = await requireUser();

  try {
    const updated = await db
      .update(prayerDays)
      .set({
        fajr: true,
        zuhr: true,
        asr: true,
        maghrib: true,
        isha: true,
        // Leave Witr untouched when it isn't being tracked.
        ...(user.trackWitr ? { witr: true } : {}),
      })
      .where(and(eq(prayerDays.id, dayId), eq(prayerDays.userId, user.id)))
      .returning({ id: prayerDays.id });

    if (updated.length === 0) {
      return { ok: false, error: "That day is no longer available." };
    }
  } catch {
    return { ok: false, error: "Couldn't save. Check your connection and retry." };
  }

  return { ok: true };
}

/**
 * Turning Witr off only hides it — the stored checkmarks stay put so turning it
 * back on restores exactly what was there.
 */
export async function setTrackWitr(value: boolean): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await db.update(users).set({ trackWitr: value }).where(eq(users.id, user.id));
  } catch {
    return { ok: false, error: "Couldn't save that setting. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}
