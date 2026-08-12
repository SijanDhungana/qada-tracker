import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { prayersFor } from "@/lib/prayers";
import { OnboardingScreen } from "@/components/OnboardingScreen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();

  const [existing] = await db
    .select({ total: count() })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));

  // The empty state is the onboarding — once there are days, it's done.
  if ((existing?.total ?? 0) > 0) redirect("/");

  return <OnboardingScreen perDay={prayersFor(user.trackWitr).length} />;
}
