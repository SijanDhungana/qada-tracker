import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { prayerDays } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/actions/auth";
import { WitrToggle } from "@/components/WitrToggle";
import { AddDaysPanel } from "@/components/AddDaysPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  const [totals] = await db
    .select({ total: count() })
    .from(prayerDays)
    .where(eq(prayerDays.userId, user.id));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-16 sm:px-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted">
            {user.username} · {(totals?.total ?? 0).toLocaleString()} days tracked
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium shadow-sm"
        >
          Back
        </Link>
      </header>

      <div className="space-y-4">
        <Section title="Prayers">
          <WitrToggle initial={user.trackWitr} />
        </Section>

        <Section title="Add more missed days">
          <AddDaysPanel />
        </Section>

        <Section title="Account">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-base font-semibold transition active:scale-[0.99]"
            >
              Log out
            </button>
          </form>
        </Section>
      </div>
    </main>
  );
}
