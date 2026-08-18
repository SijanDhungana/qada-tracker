import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyWitr,
  duhaPrayers,
  masjidPrayers,
  sunnahLog,
  tahajjudNights,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { DailyPrayerKey } from "@/lib/prayers";
import type { DuhaEntry, DuhaStatus } from "@/lib/duha";
import type { MasjidEntry, MasjidStatus, MasjidTiming } from "@/lib/masjid";
import type { SunnahEntry, SunnahPart } from "@/lib/sunnah";
import type { TahajjudEntry, TahajjudStatus } from "@/lib/tahajjud";
import type { WitrEntry, WitrStatus } from "@/lib/witr";
import { shiftDateKey, todayKeyInZone } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { MasjidHistory } from "@/components/MasjidHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MasjidPage() {
  const user = await requireUser();

  // Ninety days back covers the longest range the screen offers.
  const todayKey = todayKeyInZone(user.timezone);
  const cutoff = shiftDateKey(todayKey, -89);

  const [rows, tahajjudRows, witrRows, sunnahRows, duhaRows] = await Promise.all([
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
          gte(masjidPrayers.prayerDate, cutoff),
        ),
      )
      .orderBy(desc(masjidPrayers.prayerDate)),

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
          gte(tahajjudNights.prayerDate, cutoff),
        ),
      )
      .orderBy(desc(tahajjudNights.prayerDate)),

    db
      .select({
        prayerDate: dailyWitr.prayerDate,
        status: dailyWitr.status,
        remade: dailyWitr.remade,
        loggedAt: dailyWitr.loggedAt,
      })
      .from(dailyWitr)
      .where(and(eq(dailyWitr.userId, user.id), gte(dailyWitr.prayerDate, cutoff)))
      .orderBy(desc(dailyWitr.prayerDate)),

    db
      .select({
        prayerDate: sunnahLog.prayerDate,
        prayer: sunnahLog.prayer,
        part: sunnahLog.part,
        prayed: sunnahLog.prayed,
        loggedAt: sunnahLog.loggedAt,
      })
      .from(sunnahLog)
      .where(and(eq(sunnahLog.userId, user.id), gte(sunnahLog.prayerDate, cutoff)))
      .orderBy(desc(sunnahLog.prayerDate)),

    db
      .select({
        prayerDate: duhaPrayers.prayerDate,
        status: duhaPrayers.status,
        rakahs: duhaPrayers.rakahs,
        loggedAt: duhaPrayers.loggedAt,
      })
      .from(duhaPrayers)
      .where(and(eq(duhaPrayers.userId, user.id), gte(duhaPrayers.prayerDate, cutoff)))
      .orderBy(desc(duhaPrayers.prayerDate)),
  ]);

  const entries: MasjidEntry[] = rows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    status: row.status as MasjidStatus,
    timing: row.timing as MasjidTiming | null,
    joinedRakah: row.joinedRakah,
    reason: row.reason,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const tahajjud: TahajjudEntry[] = tahajjudRows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as TahajjudStatus,
    rakahs: row.rakahs,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const witr: WitrEntry[] = witrRows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as WitrStatus,
    remade: row.remade,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const sunnah: SunnahEntry[] = sunnahRows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    part: row.part as SunnahPart,
    prayed: row.prayed,
    loggedAt: row.loggedAt.toISOString(),
  }));

  const duha: DuhaEntry[] = duhaRows.map((row) => ({
    prayerDate: row.prayerDate,
    status: row.status as DuhaStatus,
    rakahs: row.rakahs,
    loggedAt: row.loggedAt.toISOString(),
  }));

  return (
    <AppShell username={user.username} theme={user.theme}>
      <MasjidHistory
        entries={entries}
        tahajjud={tahajjud}
        witr={witr}
        sunnah={sunnah}
        duha={duha}
        trackTahajjud={user.trackTahajjud}
        trackTahajjudRakahs={user.trackTahajjudRakahs}
        trackWitr={user.trackWitr}
        trackSunnah={user.trackSunnah}
        trackDuha={user.trackDuha}
        today={todayKey}
      />
    </AppShell>
  );
}
