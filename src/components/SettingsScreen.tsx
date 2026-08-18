"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_GOAL, MIN_GOAL, projectionSentence } from "@/lib/projection";
import { describeZone, supportedTimezones } from "@/lib/time";
import {
  previewRemoval,
  previewRemovalByCount,
  previewReset,
  removeDays,
  removeDaysByCount,
  resetProgress,
  setDailyGoal,
  setTheme,
  setTimezone,
  setTrackDuha,
  setTrackSunnah,
  setTrackTahajjud,
  setTrackTahajjudRakahs,
  setTrackWitr,
  type RemoveDirection,
  type SettingsResult,
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

/** An on/off setting with its explanation underneath. */
function ToggleRow({
  label,
  summary,
  note,
  checked,
  onChange,
  indented = false,
}: {
  label: string;
  summary: string;
  note?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Marks a setting that only matters while its parent setting is on. */
  indented?: boolean;
}) {
  return (
    <Row>
      <div className={indented ? "border-l-2 border-line pl-3" : undefined}>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="block text-body font-medium text-ink">{label}</span>
            <span className="mt-0.5 block text-meta text-ink-3">{summary}</span>
          </span>
          <span
            aria-hidden="true"
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              checked ? "bg-brand" : "bg-surface-3"
            }`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-paper transition-all ${
                checked ? "left-6" : "left-1"
              }`}
            />
          </span>
        </button>
        {note ? <p className="mt-3 text-meta text-ink-3">{note}</p> : null}
      </div>
    </Row>
  );
}

const inputClass =
  "min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink " +
  "outline-none placeholder:text-ink-3 focus:border-brand";

export function SettingsScreen({
  username,
  trackWitr,
  trackTahajjud,
  trackTahajjudRakahs,
  trackSunnah,
  trackDuha,
  dailyGoal,
  theme,
  timezone,
  totalDays,
  outstanding,
  perDay,
}: {
  username: string;
  trackWitr: boolean;
  trackTahajjud: boolean;
  trackTahajjudRakahs: boolean;
  trackSunnah: boolean;
  trackDuha: boolean;
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
  const [tahajjud, setTahajjud] = useState(trackTahajjud);
  const [tahajjudRakahs, setTahajjudRakahs] = useState(trackTahajjudRakahs);
  const [sunnah, setSunnah] = useState(trackSunnah);
  const [duha, setDuha] = useState(trackDuha);
  const [goal, setGoal] = useState(dailyGoal);
  const [themeValue, setThemeValue] = useState(theme);
  const [zone, setZone] = useState(timezone);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [, startTransition] = useTransition();

  /**
   * Flips a switch on screen straight away, then writes it. A failed write
   * puts the switch back where it was rather than leaving the UI claiming
   * something the account doesn't say.
   */
  function saveToggle(
    next: boolean,
    apply: (value: boolean) => void,
    action: (value: boolean) => Promise<SettingsResult>,
  ) {
    apply(next);
    startTransition(async () => {
      const result = await action(next).catch(() => ({
        ok: false as const,
        error: "Couldn't save that setting.",
      }));
      if (!result.ok) {
        apply(!next);
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
        <ToggleRow
          label="Track Witr"
          summary="Adds Witr to the qada ledger and to tonight's log."
          note="Turning this off just hides Witr — any Witr you've already checked off is kept and comes back if you turn it on again."
          checked={witr}
          onChange={(next) => saveToggle(next, setWitr, setTrackWitr)}
        />
        <ToggleRow
          label="Track sunnah prayers"
          summary="Tap a prayer's name to log its sunnah and nafl rak'ahs."
          note="Rak'ah counts follow the common Hanafi arrangement — 2 before Fajr, 4 before and 2 after Zuhr, and so on. They're labels on the buttons, never checks on your number, and none of it touches the qada count."
          checked={sunnah}
          onChange={(next) => saveToggle(next, setSunnah, setTrackSunnah)}
        />
        <ToggleRow
          label="Track Duha"
          summary="The forenoon prayer, from after sunrise until just before Zuhr."
          note="Recorded as prayed or missed, and on a day you prayed it, how many rak'ahs — two and eight are both ordinary, so the number is the part worth keeping."
          checked={duha}
          onChange={(next) => saveToggle(next, setDuha, setTrackDuha)}
        />
        <ToggleRow
          label="Track Tahajjud"
          summary="Adds the night prayer to Today and its own history."
          note="Recorded as prayed, woke without praying, or slept through — separate from the qada count, and never part of it."
          checked={tahajjud}
          onChange={(next) => saveToggle(next, setTahajjud, setTrackTahajjud)}
        />
        {tahajjud ? (
          <ToggleRow
            indented
            label="Count Tahajjud rak'ahs"
            summary="Also asks how many rak'ahs you prayed."
            note="Only asked on the nights you prayed. Turning it off keeps the counts already recorded."
            checked={tahajjudRakahs}
            onChange={(next) =>
              saveToggle(next, setTahajjudRakahs, setTrackTahajjudRakahs)
            }
          />
        ) : null}
      </Group>

      <Group title="Your days">
        <Row>
          <p className="text-body text-ink-2">
            <span className="num text-ink">{totalDays.toLocaleString()}</span>{" "}
            days tracked ·{" "}
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
        <Row>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="flex min-h-11 w-full items-center justify-between text-left text-body text-ink"
          >
            Reset progress
            <span aria-hidden="true" className="text-ink-3">
              ›
            </span>
          </button>
          <p className="mt-1 text-meta text-ink-3">
            Unchecks everything you&apos;ve logged. Your days stay — only what&apos;s
            marked done is cleared.
          </p>
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

      <ResetProgressSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onDone={() => {
          setResetOpen(false);
          router.refresh();
        }}
      />
    </main>
  );
}

type RemovalPreview = { days: number; logged: number };

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
  const [mode, setMode] = useState<"range" | "amount">("range");

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<RemoveDirection>("recent");

  const [preview, setPreview] = useState<RemovalPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  function resetFields() {
    setStart("");
    setEnd("");
    setAmount("");
    setPreview(null);
    setConfirmText("");
    setError(null);
  }

  function switchMode(next: "range" | "amount") {
    setMode(next);
    setPreview(null);
    setConfirmText("");
    setError(null);
  }

  function check() {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "range"
          ? await previewRemoval(start, end).catch(() => ({
              ok: false as const,
              error: "Couldn't check that range.",
            }))
          : await previewRemovalByCount(Number(amount), direction).catch(() => ({
              ok: false as const,
              error: "Couldn't check that.",
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
      const result =
        mode === "range"
          ? await removeDays(start, end).catch(() => ({
              ok: false as const,
              error: "Couldn't remove those days.",
            }))
          : await removeDaysByCount(Number(amount), direction).catch(() => ({
              ok: false as const,
              error: "Couldn't remove those days.",
            }));

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ message: `${result.removed.toLocaleString()} days removed.` });
      resetFields();
      onDone();
    });
  }

  const amountValid = Number.isInteger(Number(amount)) && Number(amount) >= 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Remove days"
      description="Remove a specific date range, or a number of days from either end of your list."
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="How to choose what to remove"
          value={mode}
          onChange={switchMode}
          options={[
            { value: "range", label: "By date range" },
            { value: "amount", label: "By amount" },
          ]}
        />

        {mode === "range" ? (
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="removeStart"
                className="mb-1.5 block text-meta text-ink-2"
              >
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
            <p className="text-meta text-ink-3">
              Only days with a real date can be removed this way — days added by
              amount have none. Use &ldquo;By amount&rdquo; for those.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="removeAmount" className="mb-1.5 block text-meta text-ink-2">
                How many days to remove
              </label>
              <input
                id="removeAmount"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="0"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setPreview(null);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <p className="mb-1.5 text-meta text-ink-2">Starting from</p>
              <SegmentedControl
                label="Which days to remove"
                size="sm"
                value={direction}
                onChange={(value) => {
                  setDirection(value);
                  setPreview(null);
                }}
                options={[
                  { value: "recent", label: "Most recently added" },
                  { value: "oldest", label: "Oldest first" },
                ]}
              />
            </div>
            <p className="text-meta text-ink-3">
              Works for every day, whether it has a date or not.
            </p>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}

        {preview === null ? (
          <button
            type="button"
            onClick={check}
            disabled={
              pending || (mode === "range" ? !start || !end : !amountValid)
            }
            className="min-h-12 w-full rounded-md border border-line text-body font-medium text-ink-2 disabled:opacity-50"
          >
            {mode === "range" ? "Check this range" : "Check this amount"}
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-danger/50 bg-danger-wash p-4">
            <p className="text-body text-ink">
              This removes{" "}
              <span className="num">{preview.days.toLocaleString()}</span> days and{" "}
              <span className="num">{preview.logged.toLocaleString()}</span>{" "}
              logged prayers. This can&apos;t be undone.
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

function ResetProgressSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [completed, setCompleted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  // Load the count the moment the sheet opens, rather than waiting for a tap —
  // there's nothing else to configure here, so a check button is just a delay.
  useEffect(() => {
    if (!open) {
      setCompleted(null);
      setConfirmText("");
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await previewReset().catch(() => ({
        ok: false as const,
        error: "Couldn't check your progress.",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCompleted(result.completed);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function confirm() {
    startTransition(async () => {
      const result = await resetProgress().catch(() => ({
        ok: false as const,
        error: "Couldn't reset your progress.",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ message: `${result.cleared.toLocaleString()} prayers reset.` });
      onDone();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reset progress"
      description="Unchecks everything. Your days and their dates stay exactly as they are."
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        ) : null}

        {completed === null ? (
          <p className="text-meta text-ink-3">Checking your progress…</p>
        ) : completed === 0 ? (
          <p className="text-meta text-ink-3">
            Nothing is checked off yet — there&apos;s nothing to reset.
          </p>
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-danger/50 bg-danger-wash p-4">
            <p className="text-body text-ink">
              This unchecks all{" "}
              <span className="num">{completed.toLocaleString()}</span>{" "}
              prayers you&apos;ve logged. This can&apos;t be undone.
            </p>

            <div>
              <label
                htmlFor="resetConfirm"
                className="mb-1.5 block text-meta text-ink-2"
              >
                Type <span className="num text-ink">confirmed</span> to proceed
              </label>
              <input
                id="resetConfirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </div>

            <button
              type="button"
              onClick={confirm}
              disabled={confirmText.trim().toLowerCase() !== "confirmed" || pending}
              className="min-h-12 w-full rounded-md bg-danger text-body font-semibold text-paper disabled:opacity-50"
            >
              {pending ? "Resetting…" : `Reset ${completed.toLocaleString()} prayers`}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
