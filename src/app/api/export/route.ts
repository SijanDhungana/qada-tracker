import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyWitr,
  masjidPrayers,
  prayerDays,
  quranLog,
  sunnahLog,
  tahajjudNights,
  worshipLog,
} from "@/db/schema";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The whole account as JSON. Accounts carry no email, so this file is the only
 * way back from a forgotten password — it is deliberately complete and
 * deliberately easy to reach. Every table holding something the user typed or
 * tapped belongs here; anything left out is data they cannot get back.
 */
export async function GET() {
  const user = await requireUser();

  const [days, masjid, nights, witr, sunnah, worship, quran] = await Promise.all([
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
    db
      .select()
      .from(tahajjudNights)
      .where(eq(tahajjudNights.userId, user.id))
      .orderBy(asc(tahajjudNights.prayerDate)),
    db
      .select()
      .from(dailyWitr)
      .where(eq(dailyWitr.userId, user.id))
      .orderBy(asc(dailyWitr.prayerDate)),
    db
      .select()
      .from(sunnahLog)
      .where(eq(sunnahLog.userId, user.id))
      .orderBy(asc(sunnahLog.prayerDate)),
    db
      .select()
      .from(worshipLog)
      .where(eq(worshipLog.userId, user.id))
      .orderBy(asc(worshipLog.prayerDate)),
    db
      .select()
      .from(quranLog)
      .where(eq(quranLog.userId, user.id))
      .orderBy(asc(quranLog.prayerDate)),
  ]);

  const payload = {
    format: "qada-tracker-export",
    version: 3,
    exportedAt: new Date().toISOString(),
    account: {
      username: user.username,
      trackWitr: user.trackWitr,
      trackTahajjud: user.trackTahajjud,
      trackTahajjudRakahs: user.trackTahajjudRakahs,
      trackSunnah: user.trackSunnah,
      dailyGoal: user.dailyGoal,
      theme: user.theme,
      timezone: user.timezone,
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
      timing: entry.timing,
      joinedRakah: entry.joinedRakah,
      reason: entry.reason,
      loggedAt: entry.loggedAt,
    })),
    tahajjud: nights.map((night) => ({
      date: night.prayerDate,
      status: night.status,
      rakahs: night.rakahs,
      loggedAt: night.loggedAt,
    })),
    witr: witr.map((entry) => ({
      date: entry.prayerDate,
      status: entry.status,
      remade: entry.remade,
      loggedAt: entry.loggedAt,
    })),
    sunnah: sunnah.map((entry) => ({
      date: entry.prayerDate,
      prayer: entry.prayer,
      part: entry.part,
      prayed: entry.prayed,
      loggedAt: entry.loggedAt,
    })),
    worship: worship.map((entry) => ({
      date: entry.prayerDate,
      kind: entry.kind,
      count: entry.count,
      loggedAt: entry.loggedAt,
    })),
    quran: quran.map((entry) => ({
      date: entry.prayerDate,
      surah: entry.surah,
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
