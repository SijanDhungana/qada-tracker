import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { LedgerScreen, type LedgerDay } from "@/components/LedgerScreen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_LIMIT = 1200;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const user = await requireUser();
  const { focus } = await searchParams;

  const [totals] = await db
    .select({ total: count() })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));

  const totalDays = totals?.total ?? 0;
  if (totalDays === 0) redirect("/onboarding");

  const days = await db
    .select({
      id: prayerDays.id,
      dayIndex: prayerDays.dayIndex,
      dayDate: prayerDays.dayDate,
      fajr: prayerDays.fajr,
      zuhr: prayerDays.zuhr,
      asr: prayerDays.asr,
      maghrib: prayerDays.maghrib,
      isha: prayerDays.isha,
      witr: prayerDays.witr,
    })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id))
    .orderBy(asc(prayerDays.dayIndex))
    .limit(DAY_LIMIT);

  return (
    <AppShell username={user.username} theme={user.theme}>
      <LedgerScreen
        key={`${user.trackWitr}-${totalDays}`}
        days={days as LedgerDay[]}
        trackWitr={user.trackWitr}
        focusId={focus}
        truncated={totalDays > DAY_LIMIT}
        totalDays={totalDays}
      />
    </AppShell>
  );
}
