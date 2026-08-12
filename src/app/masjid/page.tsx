import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { masjidPrayers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { DailyPrayerKey } from "@/lib/prayers";
import type { MasjidEntry, MasjidStatus } from "@/lib/masjid";
import { AppShell } from "@/components/AppShell";
import { MasjidHistory } from "@/components/MasjidHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MasjidPage() {
  const user = await requireUser();

  // Ninety days back covers the longest range the screen offers.
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  const rows = await db
    .select({
      prayerDate: masjidPrayers.prayerDate,
      prayer: masjidPrayers.prayer,
      status: masjidPrayers.status,
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
    .orderBy(desc(masjidPrayers.prayerDate));

  const entries: MasjidEntry[] = rows.map((row) => ({
    prayerDate: row.prayerDate,
    prayer: row.prayer as DailyPrayerKey,
    status: row.status as MasjidStatus,
    reason: row.reason,
    loggedAt: row.loggedAt.toISOString(),
  }));

  return (
    <AppShell username={user.username} theme={user.theme}>
      <MasjidHistory entries={entries} />
    </AppShell>
  );
}
