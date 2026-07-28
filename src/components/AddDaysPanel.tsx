"use client";

import { useState } from "react";
import { DayInputForm } from "./DayInputForm";

export function AddDaysPanel() {
  const [confirmation, setConfirmation] = useState(false);

  return (
    <div>
      <DayInputForm
        submitLabel="Add to my list"
        onAdded={() => setConfirmation(true)}
      />
      {confirmation ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-sm text-accent"
        >
          Added — they&apos;re at the end of your list on the dashboard.
        </p>
      ) : null}
    </div>
  );
}
