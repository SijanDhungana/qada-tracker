"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_TAHAJJUD_RAKAHS,
  MAX_TAHAJJUD_RAKAHS,
  TAHAJJUD_LABELS,
  TAHAJJUD_RAKAH_STEP,
  TAHAJJUD_STATUSES,
  type TahajjudEntry,
  type TahajjudStatus,
} from "@/lib/tahajjud";
import { WITR_LABELS, WITR_STATUSES, type WitrEntry, type WitrStatus } from "@/lib/witr";
import { formatTimeInZone } from "@/lib/time";
import { clearTahajjud, recordTahajjud } from "@/lib/actions/tahajjud";
import { clearWitr, recordWitr } from "@/lib/actions/witr";
import { useToast } from "./ui/Toast";

const CHIP =
  "min-h-11 rounded-md border px-3 text-meta font-medium transition-colors";
const CHIP_IDLE =
  "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2";

const WITR_STYLES: Record<WitrStatus, string> = {
  prayed: "border-done bg-done-wash text-done",
  missed: "border-line-strong bg-surface-2 text-ink-2",
};

const TAHAJJUD_STYLES: Record<TahajjudStatus, string> = {
  prayed: "border-done bg-done-wash text-done",
  woke: "border-line-strong bg-surface-2 text-ink",
  slept: "border-line-strong bg-surface-2 text-ink-2",
};

/**
 * Witr and Tahajjud, the two prayers of the night that aren't prayed in
 * congregation. They sit together and below the masjid strip, so the five
 * fard prayers stay the first thing on the screen.
 */
export function NightStrip({
  today,
  timezone,
  trackWitr,
  trackTahajjud,
  trackTahajjudRakahs,
  initialWitr,
  initialTahajjud,
}: {
  today: string;
  timezone: string;
  trackWitr: boolean;
  trackTahajjud: boolean;
  trackTahajjudRakahs: boolean;
  initialWitr: WitrEntry | null;
  initialTahajjud: TahajjudEntry | null;
}) {
  if (!trackWitr && !trackTahajjud) return null;

  return (
    <section aria-labelledby="night-heading" className="flex flex-col gap-3">
      <h2 id="night-heading" className="display text-section text-ink">
        Night prayers
      </h2>

      <ul className="flex flex-col gap-2">
        {trackWitr ? (
          <WitrRow today={today} timezone={timezone} initialEntry={initialWitr} />
        ) : null}
        {trackTahajjud ? (
          <TahajjudRow
            today={today}
            timezone={timezone}
            askRakahs={trackTahajjudRakahs}
            initialEntry={initialTahajjud}
          />
        ) : null}
      </ul>
    </section>
  );
}

function Row({
  name,
  when,
  loggedAt,
  timezone,
  children,
  detail,
}: {
  name: string;
  when: string;
  loggedAt: string | null;
  timezone: string;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-20">
          <p className="text-name font-medium text-ink">{name}</p>
          {loggedAt ? (
            <p className="num text-meta text-ink-3">
              {formatTimeInZone(loggedAt, timezone)}
            </p>
          ) : (
            <p className="text-meta text-ink-3">{when}</p>
          )}
        </div>
        <div className="flex gap-1.5">{children}</div>
      </div>
      {detail}
    </li>
  );
}

/** Prayed or missed, and a missed night can still be made up. */
function WitrRow({
  today,
  timezone,
  initialEntry,
}: {
  today: string;
  timezone: string;
  initialEntry: WitrEntry | null;
}) {
  const toast = useToast();
  const [entry, setEntry] = useState<WitrEntry | null>(initialEntry);
  const [pending, startTransition] = useTransition();

  function save(next: WitrEntry | null, message: string) {
    const previous = entry;
    setEntry(next);

    startTransition(async () => {
      const result = await (next
        ? recordWitr(today, next.status, next.remade)
        : clearWitr(today)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntry(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }

      toast({
        message,
        coalesceKey: "witr",
        action: {
          label: "Undo",
          run: async () => {
            setEntry(previous);
            if (previous) await recordWitr(today, previous.status, previous.remade);
            else await clearWitr(today);
          },
        },
      });
    });
  }

  function choose(status: WitrStatus) {
    if (entry?.status === status) {
      save(null, "Witr cleared");
      return;
    }
    save(
      { prayerDate: today, status, remade: false, loggedAt: new Date().toISOString() },
      `Witr · ${WITR_LABELS[status].toLowerCase()}`,
    );
  }

  function toggleRemade() {
    if (!entry || entry.status !== "missed") return;
    const remade = !entry.remade;
    save(
      { ...entry, remade, loggedAt: new Date().toISOString() },
      remade ? "Witr made up" : "Witr · missed",
    );
  }

  const showRemake = entry?.status === "missed";

  return (
    <Row
      name="Witr"
      when="Not logged"
      loggedAt={entry?.loggedAt ?? null}
      timezone={timezone}
      detail={
        showRemake ? (
          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <p className="text-meta text-ink-3">
              Missed at its time — you can still make it up.
            </p>
            <button
              type="button"
              aria-pressed={entry.remade}
              disabled={pending}
              onClick={toggleRemade}
              className={`${CHIP} shrink-0 ${
                entry.remade ? "border-done bg-done-wash text-done" : CHIP_IDLE
              }`}
            >
              {entry.remade ? "Made up ✓" : "Made it up"}
            </button>
          </div>
        ) : null
      }
    >
      <div role="group" aria-label="Witr tonight" className="flex gap-1.5">
        {WITR_STATUSES.map((status) => {
          const selected = entry?.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => choose(status)}
              className={`${CHIP} ${selected ? WITR_STYLES[status] : CHIP_IDLE}`}
            >
              {WITR_LABELS[status]}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

/** One answer per night, plus an optional rak'ah count on the nights prayed. */
function TahajjudRow({
  today,
  timezone,
  askRakahs,
  initialEntry,
}: {
  today: string;
  timezone: string;
  askRakahs: boolean;
  initialEntry: TahajjudEntry | null;
}) {
  const toast = useToast();
  const [entry, setEntry] = useState<TahajjudEntry | null>(initialEntry);
  const [pending, startTransition] = useTransition();

  function save(next: TahajjudEntry | null, message: string, notify = true) {
    const previous = entry;
    setEntry(next);

    startTransition(async () => {
      const result = await (next
        ? recordTahajjud(today, next.status, next.rakahs)
        : clearTahajjud(today)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntry(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }
      if (!notify) return;

      toast({
        message,
        coalesceKey: "tahajjud",
        action: {
          label: "Undo",
          run: async () => {
            setEntry(previous);
            if (previous) {
              await recordTahajjud(today, previous.status, previous.rakahs);
            } else {
              await clearTahajjud(today);
            }
          },
        },
      });
    });
  }

  function choose(status: TahajjudStatus) {
    if (entry?.status === status) {
      save(null, "Tahajjud cleared");
      return;
    }
    save(
      {
        prayerDate: today,
        status,
        // Seed the count so the stepper opens on something sensible rather
        // than making the user tap up from nothing.
        rakahs: askRakahs && status === "prayed" ? DEFAULT_TAHAJJUD_RAKAHS : null,
        loggedAt: new Date().toISOString(),
      },
      `Tahajjud · ${TAHAJJUD_LABELS[status].toLowerCase()}`,
    );
  }

  function stepRakahs(direction: 1 | -1) {
    if (!entry || entry.status !== "prayed") return;
    const current = entry.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS;
    const next = Math.min(
      MAX_TAHAJJUD_RAKAHS,
      Math.max(TAHAJJUD_RAKAH_STEP, current + direction * TAHAJJUD_RAKAH_STEP),
    );
    if (next === current) return;
    // No toast: the number on screen is its own confirmation, and a stepper
    // fires often enough that a toast per tap would be noise.
    save({ ...entry, rakahs: next }, "", false);
  }

  const showRakahs = askRakahs && entry?.status === "prayed";
  const rakahs = entry?.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS;

  return (
    <Row
      name="Tahajjud"
      when="Last night"
      loggedAt={entry?.loggedAt ?? null}
      timezone={timezone}
      detail={
        showRakahs ? (
          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <p className="text-meta text-ink-3">How many rak&apos;ahs?</p>
            <div
              role="group"
              aria-label="Rak'ahs of tahajjud"
              className="flex shrink-0 items-center gap-2"
            >
              <button
                type="button"
                onClick={() => stepRakahs(-1)}
                disabled={pending || rakahs <= TAHAJJUD_RAKAH_STEP}
                aria-label="Fewer rak'ahs"
                className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                −
              </button>
              <span
                className="num w-8 text-center text-name text-ink"
                aria-live="polite"
              >
                {rakahs}
              </span>
              <button
                type="button"
                onClick={() => stepRakahs(1)}
                disabled={pending || rakahs >= MAX_TAHAJJUD_RAKAHS}
                aria-label="More rak'ahs"
                className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        ) : null
      }
    >
      <div role="group" aria-label="Tahajjud last night" className="flex gap-1.5">
        {TAHAJJUD_STATUSES.map((status) => {
          const selected = entry?.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => choose(status)}
              className={`${CHIP} ${selected ? TAHAJJUD_STYLES[status] : CHIP_IDLE}`}
            >
              {TAHAJJUD_LABELS[status]}
            </button>
          );
        })}
      </div>
    </Row>
  );
}
