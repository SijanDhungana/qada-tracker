import { redirect } from "next/navigation";
import { and, asc, eq, gte, sql } from "drizzle-orm";
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
import { ALL_PRAYERS, prayersFor, type PrayerKey } from "@/lib/prayers";
import type { DailyPrayerKey } from "@/lib/prayers";
import type { MasjidEntry, MasjidStatus, MasjidTiming } from "@/lib/masjid";
import type { SunnahEntry, SunnahPart } from "@/lib/sunnah";
import type { TahajjudEntry, TahajjudStatus } from "@/lib/tahajjud";
import type { WitrEntry, WitrStatus } from "@/lib/witr";
import type { WorshipCounts, WorshipKind } from "@/lib/worship";
import { startOfTodayInZone, todayKeyInZone } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { TodayScreen, type RecentLog, type TodayData } from "@/components/TodayScreen";
import type { GridDay } from "@/components/LedgerGrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cells stay meaningful and cheap; the full record lives on /ledger. */
const GRID_LIMIT = 420;
const RECENT_LOG_LIMIT = 300;

export default async function TodayPage() {
  const user = await requireUser();
  const mine = eq(prayerDays.userId, user.id);
  const counted = prayersFor(user.trackWitr);

  const doneExpr = user.trackWitr
    ? sql`fajr and zuhr and asr and maghrib and isha and witr`
    : sql`fajr and zuhr and asr and maghrib and isha`;

  // Per-prayer outstanding counts in one pass, plus the day total.
  const [totals] = await db
    .select({
      totalDays: sql<number>`count(*)::int`,
      fajrDone: sql<number>`coalesce(sum(fajr::int), 0)::int`,
      zuhrDone: sql<number>`coalesce(sum(zuhr::int), 0)::int`,
      asrDone: sql<number>`coalesce(sum(asr::int), 0)::int`,
      maghribDone: sql<number>`coalesce(sum(maghrib::int), 0)::int`,
      ishaDone: sql<number>`coalesce(sum(isha::int), 0)::int`,
      witrDone: sql<number>`coalesce(sum(witr::int), 0)::int`,
    })
    .from(prayerDays)
    .where(mine);

  const totalDays = totals?.totalDays ?? 0;
  if (totalDays === 0) redirect("/onboarding");

  const donePerPrayer: Record<PrayerKey, number> = {
    fajr: totals?.fajrDone ?? 0,
    zuhr: totals?.zuhrDone ?? 0,
    asr: totals?.asrDone ?? 0,
    maghrib: totals?.maghribDone ?? 0,
    isha: totals?.ishaDone ?? 0,
    witr: totals?.witrDone ?? 0,
  };

  const outstandingByPrayer = {} as Record<PrayerKey, number>;
  const totalByPrayer = {} as Record<PrayerKey, number>;
  for (const prayer of ALL_PRAYERS) {
    totalByPrayer[prayer] = totalDays;
    outstandingByPrayer[prayer] = totalDays - donePerPrayer[prayer];
  }

  const completedSlots = counted.reduce(
    (sum, prayer) => sum + donePerPrayer[prayer],
    0,
  );

  // The day boundary comes from the account's timezone, not the server's clock.
  const todayKey = todayKeyInZone(user.timezone);
  const dayStartIso = startOfTodayInZone(user.timezone).toISOString();

  const [
    gridRows,
    targetRow,
    recentRows,
    masjidRows,
    tahajjudRows,
    witrRows,
    sunnahRows,
    worshipRows,
    surahRows,
  ] = await Promise.all([
    db
      .select({
        id: prayerDays.id,
        dayIndex: prayerDays.dayIndex,
        dayDate: prayerDays.dayDate,
        done: user.trackWitr
          ? sql<number>`(fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int)`
          : sql<number>`(fajr::int + zuhr::int + asr::int + maghrib::int + isha::int)`,
      })
      .from(prayerDays)
      .where(mine)
      .orderBy(asc(prayerDays.dayIndex))
      .limit(GRID_LIMIT),

    db
      .select({ id: prayerDays.id })
      .from(prayerDays)
      .where(and(mine, sql`not (${doneExpr})`))
      .orderBy(asc(prayerDays.dayIndex))
      .limit(1),

    // Unpivot the six timestamp columns so the client can bucket logs into its
    // own local "today" without the server ever guessing a timezone.
    db.execute<{
      prayer: string;
      logged_at: string;
      id: string;
      day_index: number;
      day_date: string | null;
    }>(sql`
      select * from (
        select 'fajr' as prayer, id, day_index, day_date, fajr_at as logged_at from prayer_days where user_id = ${user.id} and fajr_at is not null
        union all select 'zuhr', id, day_index, day_date, zuhr_at from prayer_days where user_id = ${user.id} and zuhr_at is not null
        union all select 'asr', id, day_index, day_date, asr_at from prayer_days where user_id = ${user.id} and asr_at is not null
        union all select 'maghrib', id, day_index, day_date, maghrib_at from prayer_days where user_id = ${user.id} and maghrib_at is not null
        union all select 'isha', id, day_index, day_date, isha_at from prayer_days where user_id = ${user.id} and isha_at is not null
        union all select 'witr', id, day_index, day_date, witr_at from prayer_days where user_id = ${user.id} and witr_at is not null
      ) logs
      order by logged_at desc
      limit ${RECENT_LOG_LIMIT}
    `),

    db
      .select({
        prayerDate: masjidPrayers.prayerDate,
        prayer: masjidPrayers.prayer,
        status: masjidPrayers.status,
        timing: masjidPrayers.timing,
        joinedRakah: masjidPrayers.joinedRakah,
        reason: masjidPrayers.reason,
        loggedAt: masjidPrayers.loggedAt,
      })
      .from(masjidPrayers)
      .where(
        and(
          eq(masjidPrayers.userId, user.id),
          gte(masjidPrayers.prayerDate, todayKey),
        ),
      ),

    db
      .select({
        prayerDate: tahajjudNights.prayerDate,
        status: tahajjudNights.status,
        rakahs: tahajjudNights.rakahs,
        loggedAt: tahajjudNights.loggedAt,
      })
      .from(tahajjudNights)
      .where(
        and(
          eq(tahajjudNights.userId, user.id),
          gte(tahajjudNights.prayerDate, todayKey),
        ),
      )
      .limit(1),

    db
      .select({
        prayerDate: dailyWitr.prayerDate,
        status: dailyWitr.status,
        remade: dailyWitr.remade,
        loggedAt: dailyWitr.loggedAt,
      })
      .from(dailyWitr)
      .where(and(eq(dailyWitr.userId, user.id), gte(dailyWitr.prayerDate, todayKey)))
      .limit(1),

    db
      .select({
        prayerDate: sunnahLog.prayerDate,
        prayer: sunnahLog.prayer,
        part: sunnahLog.part,
        prayed: sunnahLog.prayed,
        loggedAt: sunnahLog.loggedAt,
      })
      .from(sunnahLog)
      .where(and(eq(sunnahLog.userId, user.id), gte(sunnahLog.prayerDate, todayKey))),

    db
      .select({ kind: worshipLog.kind, count: worshipLog.count })
      .from(worshipLog)
      .where(
        and(eq(worshipLog.userId, user.id), gte(worshipLog.prayerDate, todayKey)),
      ),

    db
      .select({ surah: quranLog.surah })
      .from(quranLog)
      .where(and(eq(quranLog.userId, user.id), gte(quranLog.prayerDate, todayKey))),
  ]);

  const perDay = counted.length;
  const gridDays: GridDay[] = gridRows.map((row) => ({
    id: row.id,
    dayIndex: row.dayIndex,
    dayDate: row.dayDate,
    done: Number(row.done),
    total: perDay,
  }));

  const recentLogs: RecentLog[] = Array.from(recentRows).map((row) => ({
    dayId: row.id,
    dayIndex: row.day_index,
    dayDate: row.day_date,
    prayer: row.prayer as PrayerKey,
    loggedAt: new Date(row.logged_at).toISOString(),
  }));

  const masjidToday: MasjidEntry[] = masjidRows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    status: row.status as MasjidStatus,
    timing: row.timing as MasjidTiming | null,
    joinedRakah: row.joinedRakah,
    reason: row.reason,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const tahajjudToday: TahajjudEntry | null = tahajjudRows[0]
    ? {
        prayerDate: tahajjudRows[0].prayerDate,
        status: tahajjudRows[0].status as TahajjudStatus,
        rakahs: tahajjudRows[0].rakahs,
        loggedAt: tahajjudRows[0].loggedAt.toISOString(),
      }
    : null;

  const witrToday: WitrEntry | null = witrRows[0]
    ? {
        prayerDate: witrRows[0].prayerDate,
        status: witrRows[0].status as WitrStatus,
        remade: witrRows[0].remade,
        loggedAt: witrRows[0].loggedAt.toISOString(),
      }
    : null;

  const sunnahToday: SunnahEntry[] = sunnahRows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    part: row.part as SunnahPart,
    prayed: row.prayed,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const worshipToday: WorshipCounts = {};
  for (const row of worshipRows) {
    worshipToday[row.kind as WorshipKind] = row.count;
  }

  const data: TodayData = {
    trackWitr: user.trackWitr,
    dailyGoal: user.dailyGoal,
    totalSlots: totalDays * perDay,
    completedSlots,
    totalDays,
    outstandingByPrayer,
    totalByPrayer,
    gridDays,
    gridTruncated: totalDays > GRID_LIMIT,
    targetDayId: targetRow[0]?.id ?? null,
    recentLogs,
    today: todayKey,
    timezone: user.timezone,
    dayStartIso,
    masjidToday,
    trackTahajjud: user.trackTahajjud,
    trackTahajjudRakahs: user.trackTahajjudRakahs,
    tahajjudToday,
    witrToday,
    trackSunnah: user.trackSunnah,
    sunnahToday,
    worshipToday,
    surahsToday: surahRows.length,
  };

  return (
    <AppShell username={user.username} theme={user.theme}>
      <TodayScreen key={`${user.trackWitr}-${totalDays}`} data={data} />
    </AppShell>
  );
}
