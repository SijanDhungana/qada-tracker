import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { masjidPrayers, tahajjudNights } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { DailyPrayerKey } from "@/lib/prayers";
import type { MasjidEntry, MasjidStatus, MasjidTiming } from "@/lib/masjid";
import type { TahajjudEntry, TahajjudStatus } from "@/lib/tahajjud";
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

  const [rows, tahajjudRows] = await Promise.all([
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
    loggedAt: row.loggedAt.toISOString(),
  }));

  return (
    <AppShell username={user.username} theme={user.theme}>
      <MasjidHistory
        entries={entries}
        tahajjud={tahajjud}
        trackTahajjud={user.trackTahajjud}
        today={todayKey}
      />
    </AppShell>
  );
}
