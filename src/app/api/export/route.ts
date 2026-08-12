import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { masjidPrayers, prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The whole account as JSON. Accounts carry no email, so this file is the only
 * way back from a forgotten password — it is deliberately complete and
 * deliberately easy to reach.
 */
export async function GET() {
  const user = await requireUser();

  const [days, masjid] = await Promise.all([
    db
      .select()
      .from(prayerDays)
      .where(eq(prayerDays.userId, user.id))
      .orderBy(asc(prayerDays.dayIndex)),
    db
      .select()
      .from(masjidPrayers)
      .where(eq(masjidPrayers.userId, user.id))
      .orderBy(asc(masjidPrayers.prayerDate)),
  ]);

  const payload = {
    format: "qada-tracker-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: {
      username: user.username,
      trackWitr: user.trackWitr,
      dailyGoal: user.dailyGoal,
      theme: user.theme,
      createdAt: user.createdAt,
    },
    days: days.map((day) => ({
      dayIndex: day.dayIndex,
      date: day.dayDate,
      slots: {
        fajr: { done: day.fajr, loggedAt: day.fajrAt },
        zuhr: { done: day.zuhr, loggedAt: day.zuhrAt },
        asr: { done: day.asr, loggedAt: day.asrAt },
        maghrib: { done: day.maghrib, loggedAt: day.maghribAt },
        isha: { done: day.isha, loggedAt: day.ishaAt },
        witr: { done: day.witr, loggedAt: day.witrAt },
      },
    })),
    masjid: masjid.map((entry) => ({
      date: entry.prayerDate,
      prayer: entry.prayer,
      status: entry.status,
      reason: entry.reason,
      loggedAt: entry.loggedAt,
    })),
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="qada-tracker-${user.username}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
