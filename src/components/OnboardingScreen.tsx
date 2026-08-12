"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LedgerMark } from "./ui/LedgerMark";
import { DayInputForm } from "./DayInputForm";
import { Sheet } from "./ui/Sheet";
import { ToastProvider } from "./ui/Toast";

/**
 * No modal on load and no carousel — the empty state is the onboarding.
 */
export function OnboardingScreen({ perDay }: { perDay: number }) {
  return (
    <ToastProvider>
      <Inner perDay={perDay} />
    </ToastProvider>
  );
}

function Inner({ perDay }: { perDay: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-lg border border-line bg-surface p-6 text-center">
        <LedgerMark size={40} className="mx-auto" />
        <h1 className="display mt-5 text-title text-ink">Nothing tracked yet.</h1>
        <p className="mt-2 text-body text-ink-2">
          Tell Qada Tracker how much you&apos;re making up and it&apos;ll break it
          into days.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 min-h-12 w-full rounded-md bg-brand text-body font-semibold text-done-ink"
        >
          Add missed days
        </button>

        <p className="mt-3 text-meta text-ink-3">
          You can change or remove this later.
        </p>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add missed days"
        description="Give your best estimate — this is easy to change."
      >
        <DayInputForm
          perDay={perDay}
          submitLabel="Start tracking"
          onDone={() => {
            setOpen(false);
            router.push("/");
          }}
        />
      </Sheet>
    </main>
  );
}
