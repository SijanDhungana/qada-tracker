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
import {
  DEFAULT_DUHA_RAKAHS,
  DUHA_LABELS,
  DUHA_RAKAH_STEP,
  DUHA_STATUSES,
  MAX_DUHA_RAKAHS,
  type DuhaEntry,
  type DuhaStatus,
} from "@/lib/duha";
import { WITR_LABELS, WITR_STATUSES, type WitrEntry, type WitrStatus } from "@/lib/witr";
import { formatTimeInZone } from "@/lib/time";
import { clearTahajjud, recordTahajjud } from "@/lib/actions/tahajjud";
import { clearDuha, recordDuha } from "@/lib/actions/duha";
import { clearWitr, recordWitr } from "@/lib/actions/witr";
import { useToast } from "./ui/Toast";

const CHIP =
  "min-h-11 rounded-md border px-3 text-meta font-medium transition-colors";
const CHIP_IDLE =
  "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink-2";
const PRAYED = "border-done bg-done-wash text-done";
const NOT_PRAYED = "border-line-strong bg-surface-2 text-ink-2";

const WITR_STYLES: Record<WitrStatus, string> = {
  prayed: PRAYED,
  missed: NOT_PRAYED,
};

const DUHA_STYLES: Record<DuhaStatus, string> = {
  prayed: PRAYED,
  missed: NOT_PRAYED,
};

const TAHAJJUD_STYLES: Record<TahajjudStatus, string> = {
  prayed: PRAYED,
  woke: "border-line-strong bg-surface-2 text-ink",
  slept: NOT_PRAYED,
};

/**
 * The prayers outside the five fard ones: Duha in the forenoon, Witr at night,
 * Tahajjud in the last part of it. In that order, so the section reads down
 * the day, and below the masjid strip so the five stay first on the screen.
 *
 * The heading avoids calling them "voluntary": Witr is wajib in the Hanafi
 * school, and the app has no business ruling on that in a section title.
 */
export function ExtraPrayers({
  today,
  timezone,
  trackDuha,
  trackWitr,
  trackTahajjud,
  trackTahajjudRakahs,
  initialDuha,
  initialWitr,
  initialTahajjud,
}: {
  today: string;
  timezone: string;
  trackDuha: boolean;
  trackWitr: boolean;
  trackTahajjud: boolean;
  trackTahajjudRakahs: boolean;
  initialDuha: DuhaEntry | null;
  initialWitr: WitrEntry | null;
  initialTahajjud: TahajjudEntry | null;
}) {
  if (!trackDuha && !trackWitr && !trackTahajjud) return null;

  return (
    <section aria-labelledby="extra-heading" className="flex flex-col gap-3">
      <h2 id="extra-heading" className="display text-section text-ink">
        Beyond the five
      </h2>

      <ul className="flex flex-col gap-2">
        {trackDuha ? (
          <DuhaRow today={today} timezone={timezone} initialEntry={initialDuha} />
        ) : null}
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

/** Shared by Duha and Tahajjud — both count in pairs and both start at two. */
function RakahStepper({
  label,
  value,
  step,
  max,
  disabled,
  onStep,
}: {
  label: string;
  value: number;
  step: number;
  max: number;
  disabled: boolean;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-line pt-2.5">
      <p className="text-meta text-ink-3">How many rak&apos;ahs?</p>
      <div role="group" aria-label={label} className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={disabled || value <= step}
          aria-label="Fewer rak'ahs"
          className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          −
        </button>
        <span className="num w-8 text-center text-name text-ink" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={disabled || value >= max}
          aria-label="More rak'ahs"
          className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Prayed or not, and on a day it was prayed, how many rak'ahs. */
function DuhaRow({
  today,
  timezone,
  initialEntry,
}: {
  today: string;
  timezone: string;
  initialEntry: DuhaEntry | null;
}) {
  const toast = useToast();
  const [entry, setEntry] = useState<DuhaEntry | null>(initialEntry);
  const [pending, startTransition] = useTransition();

  function save(next: DuhaEntry | null, message: string, notify = true) {
    const previous = entry;
    setEntry(next);

    startTransition(async () => {
      const result = await (next
        ? recordDuha(today, next.status, next.rakahs)
        : clearDuha(today)
      ).catch(() => ({ ok: false as const, error: "Couldn't save that." }));

      if (!result.ok) {
        setEntry(previous);
        toast({ message: result.error, tone: "danger" });
        return;
      }
      if (!notify) return;

      toast({
        message,
        coalesceKey: "duha",
        action: {
          label: "Undo",
          run: async () => {
            setEntry(previous);
            if (previous) await recordDuha(today, previous.status, previous.rakahs);
            else await clearDuha(today);
          },
        },
      });
    });
  }

  function choose(status: DuhaStatus) {
    if (entry?.status === status) {
      save(null, "Duha cleared");
      return;
    }
    save(
      {
        prayerDate: today,
        status,
        // Seed the count so the stepper opens on something sensible rather
        // than making the user tap up from nothing.
        rakahs: status === "prayed" ? DEFAULT_DUHA_RAKAHS : null,
        loggedAt: new Date().toISOString(),
      },
      `Duha · ${DUHA_LABELS[status].toLowerCase()}`,
    );
  }

  function stepRakahs(direction: 1 | -1) {
    if (!entry || entry.status !== "prayed") return;
    const current = entry.rakahs ?? DEFAULT_DUHA_RAKAHS;
    const next = Math.min(
      MAX_DUHA_RAKAHS,
      Math.max(DUHA_RAKAH_STEP, current + direction * DUHA_RAKAH_STEP),
    );
    if (next === current) return;
    // No toast: the number on screen is its own confirmation.
    save({ ...entry, rakahs: next }, "", false);
  }

  return (
    <Row
      name="Duha"
      when="Forenoon"
      loggedAt={entry?.loggedAt ?? null}
      timezone={timezone}
      detail={
        entry?.status === "prayed" ? (
          <RakahStepper
            label="Rak'ahs of duha"
            value={entry.rakahs ?? DEFAULT_DUHA_RAKAHS}
            step={DUHA_RAKAH_STEP}
            max={MAX_DUHA_RAKAHS}
            disabled={pending}
            onStep={stepRakahs}
          />
        ) : null
      }
    >
      <div role="group" aria-label="Duha today" className="flex gap-1.5">
        {DUHA_STATUSES.map((status) => {
          const selected = entry?.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => choose(status)}
              className={`${CHIP} ${selected ? DUHA_STYLES[status] : CHIP_IDLE}`}
            >
              {DUHA_LABELS[status]}
            </button>
          );
        })}
      </div>
    </Row>
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
    save({ ...entry, rakahs: next }, "", false);
  }

  return (
    <Row
      name="Tahajjud"
      when="Last night"
      loggedAt={entry?.loggedAt ?? null}
      timezone={timezone}
      detail={
        askRakahs && entry?.status === "prayed" ? (
          <RakahStepper
            label="Rak'ahs of tahajjud"
            value={entry.rakahs ?? DEFAULT_TAHAJJUD_RAKAHS}
            step={TAHAJJUD_RAKAH_STEP}
            max={MAX_TAHAJJUD_RAKAHS}
            disabled={pending}
            onStep={stepRakahs}
          />
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
