import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Dashboard, type DayRow } from "@/components/Dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 1000;

const DAY_COLUMNS = {
  id: prayerDays.id,
  dayIndex: prayerDays.dayIndex,
  dayDate: prayerDays.dayDate,
  fajr: prayerDays.fajr,
  zuhr: prayerDays.zuhr,
  asr: prayerDays.asr,
  maghrib: prayerDays.maghrib,
  isha: prayerDays.isha,
  witr: prayerDays.witr,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const user = await requireUser();
  const { show } = await searchParams;

  const requested = Number(show);
  const limit =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, MAX_LIMIT)
      : DEFAULT_LIMIT;

  // Witr only counts when the user has it switched on.
  const isDone = user.trackWitr
    ? sql`fajr and zuhr and asr and maghrib and isha and witr`
    : sql`fajr and zuhr and asr and maghrib and isha`;
  const doneInDay = user.trackWitr
    ? sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int`
    : sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int`;

  const mine = eq(prayerDays.userId, user.id);

  // Totals come from the database so they stay correct even though we only send
  // a slice of the days to the browser.
  const [totals] = await db
    .select({
      totalDays: sql<number>`count(*)::int`,
      completedDays: sql<number>`(count(*) filter (where ${isDone}))::int`,
      completedPrayers: sql<number>`coalesce(sum(${doneInDay}), 0)::int`,
    })
    .from(prayerDays)
    .where(mine);

  const totalDays = totals?.totalDays ?? 0;

  if (totalDays === 0) redirect("/onboarding");

  const [incomplete, completed] = await Promise.all([
    db
      .select(DAY_COLUMNS)
      .from(prayerDays)
      .where(and(mine, sql`not (${isDone})`))
      .orderBy(asc(prayerDays.dayIndex))
      .limit(limit),
    db
      .select(DAY_COLUMNS)
      .from(prayerDays)
      .where(and(mine, isDone))
      .orderBy(asc(prayerDays.dayIndex))
      .limit(DEFAULT_LIMIT),
  ]);

  return (
    <Dashboard
      // Reset the client's optimistic state when the underlying set changes
      // (Witr toggled, days added, more days loaded).
      key={`${user.trackWitr}-${totalDays}-${limit}`}
      username={user.username}
      trackWitr={user.trackWitr}
      totalDays={totalDays}
      totalCompletedDays={totals?.completedDays ?? 0}
      totalCompletedPrayers={totals?.completedPrayers ?? 0}
      loadedDays={[...incomplete, ...completed] as DayRow[]}
      loadedIncompleteCount={incomplete.length}
      shownLimit={limit}
    />
  );
}
