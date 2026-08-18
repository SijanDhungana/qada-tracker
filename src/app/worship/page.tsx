import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { quranLog, worshipLog } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { shiftDateKey, todayKeyInZone } from "@/lib/time";
import {
  countsFor,
  type WorshipCounts,
  type WorshipKind,
} from "@/lib/worship";
import { AppShell } from "@/components/AppShell";
import { WorshipScreen, type WorshipData } from "@/components/WorshipScreen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WorshipPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const todayKey = todayKeyInZone(user.timezone);

  // A date in the query is a convenience, never a source of authority: it only
  // chooses which of this user's own days to show, and can't reach the future.
  const requested = params.date;
  const dateKey =
    typeof requested === "string" && DATE_RE.test(requested) && requested <= todayKey
      ? requested
      : todayKey;

  // One query covers both the chosen day and the trailing week's totals.
  const weekStart = shiftDateKey(todayKey, -6);
  const windowStart = dateKey < weekStart ? dateKey : weekStart;

  const [rows, surahRows] = await Promise.all([
    db
      .select({
        prayerDate: worshipLog.prayerDate,
        kind: worshipLog.kind,
        count: worshipLog.count,
      })
      .from(worshipLog)
      .where(
        and(
          eq(worshipLog.userId, user.id),
          gte(worshipLog.prayerDate, windowStart),
          lte(worshipLog.prayerDate, todayKey),
        ),
      ),

    db
      .select({ surah: quranLog.surah })
      .from(quranLog)
      .where(
        and(eq(quranLog.userId, user.id), eq(quranLog.prayerDate, dateKey)),
      )
      .orderBy(asc(quranLog.surah)),
  ]);

  const values = rows.map((row) => ({
    prayerDate: row.prayerDate,
    kind: row.kind as WorshipKind,
    count: row.count,
  }));

  const weekCounts: WorshipCounts = {};
  for (const row of values) {
    if (row.prayerDate < weekStart) continue;
    weekCounts[row.kind] = (weekCounts[row.kind] ?? 0) + row.count;
  }

  const data: WorshipData = {
    dateKey,
    today: todayKey,
    counts: countsFor(values, dateKey),
    weekCounts,
    surahs: surahRows.map((row) => row.surah),
  };

  return (
    <AppShell username={user.username} theme={user.theme}>
      <WorshipScreen key={dateKey} data={data} />
    </AppShell>
  );
}
