import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { prayersFor } from "@/lib/prayers";
import { AppShell } from "@/components/AppShell";
import { SettingsScreen } from "@/components/SettingsScreen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const perDay = prayersFor(user.trackWitr).length;

  const doneExpr = user.trackWitr
    ? sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int + witr::int`
    : sql`fajr::int + zuhr::int + asr::int + maghrib::int + isha::int`;

  const [totals] = await db
    .select({
      totalDays: sql<number>`count(*)::int`,
      completed: sql<number>`coalesce(sum(${doneExpr}), 0)::int`,
    })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));

  const totalDays = totals?.totalDays ?? 0;
  const outstanding = totalDays * perDay - (totals?.completed ?? 0);

  return (
    <AppShell username={user.username} theme={user.theme}>
      <SettingsScreen
        username={user.username}
        trackWitr={user.trackWitr}
        dailyGoal={user.dailyGoal}
        theme={user.theme}
        totalDays={totalDays}
        outstanding={outstanding}
        perDay={perDay}
      />
    </AppShell>
  );
}
