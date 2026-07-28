import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { DayInputForm } from "@/components/DayInputForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();

  const [existing] = await db
    .select({ total: count() })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));

  // Onboarding is a one-time step; extra days get added from Settings.
  if ((existing?.total ?? 0) > 0) redirect("/");

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-accent">Step 1 of 1</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          How much do you need to catch up on?
        </h1>
        <p className="mt-2 text-sm text-muted">
          Give your best estimate — you can always add more later from Settings.
        </p>
      </header>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <DayInputForm submitLabel="Start tracking" redirectTo="/" />
      </div>
    </main>
  );
}
