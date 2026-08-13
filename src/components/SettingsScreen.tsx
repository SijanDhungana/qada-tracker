"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_GOAL, MIN_GOAL, projectionSentence } from "@/lib/projection";
import { describeZone, supportedTimezones } from "@/lib/time";
import {
  previewRemoval,
  removeDays,
  setDailyGoal,
  setTheme,
  setTimezone,
  setTrackWitr,
} from "@/lib/actions/settings";
import { DayInputForm } from "./DayInputForm";
import { Sheet } from "./ui/Sheet";
import { SegmentedControl } from "./ui/SegmentedControl";
import { useToast } from "./ui/Toast";

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-meta font-medium tracking-wide text-ink-3 uppercase">
        {title}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}

const inputClass =
  "min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink " +
  "outline-none placeholder:text-ink-3 focus:border-brand";

export function SettingsScreen({
  username,
  trackWitr,
  dailyGoal,
  theme,
  timezone,
  totalDays,
  outstanding,
  perDay,
}: {
  username: string;
  trackWitr: boolean;
  dailyGoal: number;
  theme: string;
  timezone: string;
  totalDays: number;
  outstanding: number;
  perDay: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [witr, setWitr] = useState(trackWitr);
  const [goal, setGoal] = useState(dailyGoal);
  const [themeValue, setThemeValue] = useState(theme);
  const [zone, setZone] = useState(timezone);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [, startTransition] = useTransition();

  function saveWitr(next: boolean) {
    setWitr(next);
    startTransition(async () => {
      const result = await setTrackWitr(next).catch(() => ({
        ok: false as const,
        error: "Couldn't save that setting.",
      }));
      if (!result.ok) {
        setWitr(!next);
        toast({ message: result.error, tone: "danger" });
        return;
      }
      router.refresh();
    });
  }

  function saveGoal(next: number) {
    const clamped = Math.min(MAX_GOAL, Math.max(MIN_GOAL, next));
    setGoal(clamped);
    startTransition(async () => {
      await setDailyGoal(clamped).catch(() => null);
      router.refresh();
    });
  }

  function saveZone(next: string) {
    const previous = zone;
    setZone(next);
    setZoneError(null);
    startTransition(async () => {
      const result = await setTimezone(next).catch(() => ({
        ok: false as const,
        error: "Couldn't save that setting.",
      }));
      if (!result.ok) {
        setZone(previous);
        setZoneError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveTheme(next: string) {
    setThemeValue(next);
    // Apply immediately, and mirror it so the pre-paint script has it next time.
    try {
      localStorage.setItem("qada-theme", next);
      if (next === "dark" || next === "light") {
        document.documentElement.setAttribute("data-theme", next);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch {
      /* storage unavailable */
    }
    startTransition(async () => {
      await setTheme(next).catch(() => null);
    });
  }

  const zones = useMemo(() => {
    const all = supportedTimezones();
    // Keep the saved zone selectable even if this runtime doesn't list it.
    return all.includes(zone) ? all : [zone, ...all];
  }, [zone]);

  // Rendered only after mount, and refreshed on a timer. Seeding it during SSR
  // would bake in the server's instant and hydrate against a different one.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const zoneNow = now === null ? null : describeZone(zone, new Date(now));

  const projection = projectionSentence(outstanding, goal, zone);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="display text-title text-ink">Settings</h1>

      <Group title="Goal">
        <Row>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-body font-medium text-ink">Daily goal</p>
              <p className="mt-0.5 text-meta text-ink-3">
                Prayers you aim to make up each day.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => saveGoal(goal - 1)}
                disabled={goal <= MIN_GOAL}
                aria-label="Lower the daily goal"
                className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                −
              </button>
              <span className="num w-8 text-center text-name text-ink">{goal}</span>
              <button
                type="button"
                onClick={() => saveGoal(goal + 1)}
                disabled={goal >= MAX_GOAL}
                aria-label="Raise the daily goal"
                className="grid size-11 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
          {projection ? (
            <p className="mt-3 text-meta text-ink-3">{projection}</p>
          ) : (
            <p className="mt-3 text-meta text-ink-3">
              Nothing outstanding to project.
            </p>
          )}
        </Row>
      </Group>

      <Group title="Prayers">
        <Row>
          <button
            type="button"
            role="switch"
            aria-checked={witr}
            onClick={() => saveWitr(!witr)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <span>
              <span className="block text-body font-medium text-ink">Track Witr</span>
              <span className="mt-0.5 block text-meta text-ink-3">
                Adds Witr as a 6th prayer on every day.
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                witr ? "bg-brand" : "bg-surface-3"
              }`}
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-paper transition-all ${
                  witr ? "left-6" : "left-1"
                }`}
              />
            </span>
          </button>
          <p className="mt-3 text-meta text-ink-3">
            Turning this off just hides Witr — any Witr you&apos;ve already checked
            off is kept and comes back if you turn it on again.
          </p>
        </Row>
      </Group>

      <Group title="Your days">
        <Row>
          <p className="text-body text-ink-2">
            <span className="num text-ink">{totalDays.toLocaleString()}</span> days
            tracked ·{" "}
            <span className="num text-ink">
              {(totalDays * perDay).toLocaleString()}
            </span>{" "}
            prayers
          </p>
        </Row>
        <Row>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex min-h-11 w-full items-center justify-between text-left text-body text-ink"
          >
            Add missed days
            <span aria-hidden="true" className="text-ink-3">
              ›
            </span>
          </button>
        </Row>
        <Row>
          <button
            type="button"
            onClick={() => setRemoveOpen(true)}
            className="flex min-h-11 w-full items-center justify-between text-left text-body text-ink"
          >
            Remove days
            <span aria-hidden="true" className="text-ink-3">
              ›
            </span>
          </button>
        </Row>
      </Group>

      <Group title="Your day">
        <Row>
          <label htmlFor="timezone" className="block text-body font-medium text-ink">
            Timezone
          </label>
          <p className="mt-0.5 mb-3 text-meta text-ink-3">
            Your day runs midnight to midnight here. Everything logged is stamped
            against this clock.
          </p>
          <select
            id="timezone"
            value={zone}
            onChange={(event) => saveZone(event.target.value)}
            className={inputClass}
          >
            {zones.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="mt-2 min-h-5 text-meta text-ink-3">
            {zoneNow ? (
              <>
                Right now it&apos;s{" "}
                <span className="num text-ink-2">{zoneNow}</span> there.
              </>
            ) : null}
          </p>
          {zoneError ? (
            <p role="alert" className="mt-2 text-meta text-danger">
              {zoneError}
            </p>
          ) : null}
        </Row>
      </Group>

      <Group title="Appearance">
        <Row>
          <p className="mb-3 text-body font-medium text-ink">Theme</p>
          <SegmentedControl
            label="Theme"
            value={themeValue}
            onChange={saveTheme}
            options={[
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
        </Row>
      </Group>

      <Group title="Data">
        <Row>
          <a
            href="/api/export"
            className="flex min-h-11 w-full items-center justify-between text-body text-ink"
          >
            Export my data
            <span aria-hidden="true" className="text-ink-3">
              ↓
            </span>
          </a>
          <p className="mt-1 text-meta text-ink-3">
            Downloads everything as a JSON file.
          </p>
        </Row>
      </Group>

      <Group title="Account">
        <Row>
          <p className="text-body text-ink">{username}</p>
        </Row>
        <Row>
          <div className="rounded-md border border-today/40 bg-today-wash p-4">
            <p className="text-body font-medium text-ink">Keep a copy of your data</p>
            <p className="mt-1 text-meta text-ink-2">
              Your account has no email. If you forget your password there&apos;s no
              way to recover it — export your data to keep a copy.
            </p>
            <a
              href="/api/export"
              className="mt-3 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-body font-semibold text-done-ink"
            >
              Export now
            </a>
          </div>
        </Row>
      </Group>

      <Group title="About">
        <Row>
          <p className="text-meta text-ink-3">
            Qada Tracker counts what you tell it to count. For questions about
            what&apos;s owed or how to make it up, ask a scholar you trust.
          </p>
        </Row>
      </Group>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add missed days"
        description="Added to the end of your list. You can remove them later."
      >
        <DayInputForm perDay={perDay} onDone={() => setAddOpen(false)} />
      </Sheet>

      <RemoveDaysSheet
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onDone={() => {
          setRemoveOpen(false);
          router.refresh();
        }}
      />
    </main>
  );
}

function RemoveDaysSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [preview, setPreview] = useState<{ days: number; logged: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function check() {
    setError(null);
    startTransition(async () => {
      const result = await previewRemoval(start, end).catch(() => ({
        ok: false as const,
        error: "Couldn't check that range.",
      }));
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setPreview({ days: result.days, logged: result.logged });
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await removeDays(start, end).catch(() => ({
        ok: false as const,
        error: "Couldn't remove those days.",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ message: `${result.removed.toLocaleString()} days removed.` });
      setStart("");
      setEnd("");
      setPreview(null);
      setConfirmText("");
      onDone();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Remove days"
      description="Only days with real dates can be removed by range."
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="removeStart" className="mb-1.5 block text-meta text-ink-2">
            From
          </label>
          <input
            id="removeStart"
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setPreview(null);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="removeEnd" className="mb-1.5 block text-meta text-ink-2">
            To
          </label>
          <input
            id="removeEnd"
            type="date"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setPreview(null);
            }}
            className={inputClass}
          />
        </div>

        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}

        {preview === null ? (
          <button
            type="button"
            onClick={check}
            disabled={!start || !end || pending}
            className="min-h-12 w-full rounded-md border border-line text-body font-medium text-ink-2 disabled:opacity-50"
          >
            Check this range
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-danger/50 bg-danger-wash p-4">
            <p className="text-body text-ink">
              This removes{" "}
              <span className="num">{preview.days.toLocaleString()}</span> days and{" "}
              <span className="num">{preview.logged.toLocaleString()}</span> logged
              prayers. This can&apos;t be undone.
            </p>

            <div>
              <label
                htmlFor="removeConfirm"
                className="mb-1.5 block text-meta text-ink-2"
              >
                Type <span className="num text-ink">remove</span> to confirm
              </label>
              <input
                id="removeConfirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={confirmText.trim().toLowerCase() !== "remove" || pending}
              className="min-h-12 w-full rounded-md bg-danger text-body font-semibold text-paper disabled:opacity-50"
            >
              {pending ? "Removing…" : `Remove ${preview.days.toLocaleString()} days`}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
