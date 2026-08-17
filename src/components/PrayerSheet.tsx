"use client";

import { useEffect, useState } from "react";
import { PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  MASJID_TIMINGS,
  MAX_REASON_LENGTH,
  RAKAH_COUNT,
  REASON_SUGGESTIONS,
  STATUS_SHORT,
  TIMING_LABELS,
  rakahOptions,
  type MasjidStatus,
  type MasjidTiming,
} from "@/lib/masjid";
import {
  PART_LABELS,
  partsFor,
  rakahLabel,
  rakahNoun,
  type PartAnswers,
  type SunnahPart,
} from "@/lib/sunnah";
import { formatDateKey } from "@/lib/time";
import { Sheet } from "./ui/Sheet";

export type SheetTarget = {
  dateKey: string;
  prayer: DailyPrayerKey;
  status?: MasjidStatus;
  timing?: MasjidTiming | null;
  joinedRakah?: string | null;
  reason?: string | null;
  /** Answers already recorded for the voluntary rak'ahs. */
  parts?: PartAnswers;
  /** Whether to show the sunnah and nafl section at all. */
  showParts: boolean;
};

export type SheetSave = {
  /** Null when no fard status was chosen — the sunnah alone is being logged. */
  masjid: {
    status: MasjidStatus;
    timing: MasjidTiming | null;
    joinedRakah: string | null;
    reason: string | null;
  } | null;
  parts: PartAnswers;
};

const STATUS_STYLES: Record<MasjidStatus, string> = {
  masjid: "border-done bg-done-wash text-done",
  alone: "border-line-strong bg-surface-3 text-ink",
  missed: "border-line-strong bg-surface-3 text-ink-2",
};

const chipBase =
  "min-h-11 rounded-md border px-3 text-meta font-medium transition-colors";
const chipOff = "border-line bg-surface-2 text-ink-2 hover:text-ink";
const chipOn = "border-brand bg-brand-wash text-brand";

/**
 * One prayer in full: the voluntary rak'ahs before it, the fard itself, and
 * the voluntary rak'ahs after.
 *
 * Everything is staged and committed together by Save. Mixing instant toggles
 * with a Save button in the same sheet would leave the user unsure which of
 * their taps had already stuck.
 */
export function PrayerSheet({
  target,
  onClose,
  onSave,
  onClear,
}: {
  target: SheetTarget | null;
  onClose: () => void;
  onSave: (value: SheetSave) => void;
  onClear?: () => void;
}) {
  const [status, setStatus] = useState<MasjidStatus | null>(null);
  const [timing, setTiming] = useState<MasjidTiming | null>(null);
  const [rakah, setRakah] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [parts, setParts] = useState<PartAnswers>({});

  useEffect(() => {
    if (!target) return;
    setStatus(target.status ?? null);
    setTiming(target.timing ?? null);
    setRakah(target.joinedRakah ?? null);
    setReason(target.reason ?? "");
    setParts(target.parts ?? {});
  }, [target]);

  if (!target) {
    // Keep the dialog mounted but closed so its open/close transition is stable.
    return (
      <Sheet open={false} onClose={onClose} title="">
        <div />
      </Sheet>
    );
  }

  const specs = target.showParts ? partsFor(target.prayer) : [];
  const before = specs.filter((spec) => spec.part === "before");
  const afterwards = specs.filter((spec) => spec.part !== "before");

  const atMasjid = status === "masjid";
  const isLate = atMasjid && timing === "late";
  // A note explains being late, or not being at the masjid at all.
  const wantsReason = (status !== null && !atMasjid) || isLate;
  // At the masjid you must say whether you made it from the start. With no
  // status at all there is nothing to validate — the sunnah can stand alone.
  const canSave = status === null || !atMasjid || timing !== null;

  function togglePart(part: SunnahPart, prayed: boolean) {
    setParts((current) => {
      const next = { ...current };
      // Tapping the current answer again returns the part to unanswered.
      if (next[part] === prayed) delete next[part];
      else next[part] = prayed;
      return next;
    });
  }

  function submit() {
    onSave({
      masjid:
        status === null
          ? null
          : {
              status,
              timing: atMasjid ? timing : null,
              joinedRakah: isLate ? rakah : null,
              reason: wantsReason ? reason.trim() || null : null,
            },
      parts,
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={PRAYER_LABELS[target.prayer]}
      description={formatDateKey(target.dateKey)}
    >
      <div className="flex flex-col gap-5">
        {before.map((spec) => (
          <PartRow
            key={spec.part}
            part={spec.part}
            rakahs={spec.rakahs}
            emphasised={spec.emphasised}
            answer={parts[spec.part]}
            onChoose={(prayed) => togglePart(spec.part, prayed)}
          />
        ))}

        <section className="flex flex-col gap-3 rounded-md border border-line-strong bg-surface-2 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-name font-medium text-ink">Fard</p>
            <p className="text-meta text-ink-3">
              <span className="num">{RAKAH_COUNT[target.prayer]}</span>{" "}
              {rakahNoun(RAKAH_COUNT[target.prayer])}
            </p>
          </div>

          <div>
            <p className="mb-2 text-meta text-ink-2">Where did you pray it?</p>
            <div
              role="radiogroup"
              aria-label="Where was it prayed?"
              className="flex gap-2"
            >
              {MASJID_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={status === option}
                  onClick={() => {
                    // Tapping the chosen answer again drops back to unanswered,
                    // so a prayer can carry sunnah with no fard record.
                    if (status === option) {
                      setStatus(null);
                      setTiming(null);
                      setRakah(null);
                      return;
                    }
                    setStatus(option);
                    if (option !== "masjid") {
                      setTiming(null);
                      setRakah(null);
                    }
                  }}
                  className={`min-h-12 flex-1 rounded-md border px-2 text-meta font-medium transition-colors ${
                    status === option
                      ? STATUS_STYLES[option]
                      : "border-line bg-surface text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {STATUS_SHORT[option]}
                </button>
              ))}
            </div>
          </div>

          {atMasjid ? (
            <div>
              <p className="mb-2 text-meta text-ink-2">
                Did you catch it from the start?
              </p>
              <div
                role="radiogroup"
                aria-label="On time or late?"
                className="flex gap-2"
              >
                {MASJID_TIMINGS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={timing === option}
                    onClick={() => {
                      setTiming(option);
                      if (option === "on_time") {
                        setRakah(null);
                        setReason("");
                      }
                    }}
                    className={`min-h-12 flex-1 ${chipBase} ${
                      timing === option ? chipOn : chipOff
                    }`}
                  >
                    {TIMING_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isLate ? (
            <div>
              <p className="mb-2 text-meta text-ink-2">
                Which rak&apos;ah did you join for?
              </p>
              <div
                role="radiogroup"
                aria-label="Which rak'ah did you join for?"
                className="flex flex-wrap gap-2"
              >
                {rakahOptions(target.prayer).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={rakah === option.value}
                    onClick={() => setRakah(option.value)}
                    className={`${chipBase} ${
                      rakah === option.value ? chipOn : chipOff
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {wantsReason ? (
            <div className="flex flex-col gap-3">
              <p className="text-meta text-ink-2">
                {isLate
                  ? "What held you up?"
                  : "Add a note if it helps you spot a pattern."}
              </p>
              <div className="flex flex-wrap gap-2">
                {REASON_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setReason((current) => (current === suggestion ? "" : suggestion))
                    }
                    aria-pressed={reason === suggestion}
                    className={`${chipBase} ${reason === suggestion ? chipOn : chipOff}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="masjid-reason"
                  className="mb-1.5 block text-meta text-ink-2"
                >
                  Or write your own
                </label>
                <input
                  id="masjid-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={MAX_REASON_LENGTH}
                  placeholder="Optional"
                  className="min-h-12 w-full rounded-md border border-line bg-surface px-3 text-body
                             text-ink outline-none placeholder:text-ink-3 focus:border-brand"
                />
              </div>
            </div>
          ) : null}
        </section>

        {afterwards.map((spec) => (
          <PartRow
            key={spec.part}
            part={spec.part}
            rakahs={spec.rakahs}
            emphasised={spec.emphasised}
            answer={parts[spec.part]}
            onChoose={(prayed) => togglePart(spec.part, prayed)}
          />
        ))}

        {target.showParts && specs.length === 0 ? (
          <p className="text-meta text-ink-3">
            No sunnah or nafl rak&apos;ahs are attached to this prayer.
          </p>
        ) : null}

        <div className="flex gap-2">
          {onClear && (target.status || Object.keys(target.parts ?? {}).length > 0) ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-12 rounded-md border border-line px-4 text-body font-medium text-ink-3 hover:bg-surface-2"
            >
              Clear
            </button>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="min-h-12 flex-1 rounded-md bg-brand text-body font-semibold text-done-ink disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** One voluntary block: what it is, how many rak'ahs, prayed or not. */
function PartRow({
  part,
  rakahs,
  emphasised,
  answer,
  onChoose,
}: {
  part: SunnahPart;
  rakahs: number;
  emphasised: boolean;
  answer: boolean | undefined;
  onChoose: (prayed: boolean) => void;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-name font-medium text-ink">{PART_LABELS[part]}</p>
        {/* Only the number takes the tabular face; the words stay in the body
            font rather than being set in the numeric one. */}
        <p className="text-meta text-ink-3">
          <span className="num">{rakahs}</span> {rakahNoun(rakahs)}
          {emphasised ? (
            <span className="text-done"> · emphasised</span>
          ) : (
            <span className="text-ink-3"> · optional</span>
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={`${PART_LABELS[part]}, ${rakahLabel(rakahs)}`}
        className="flex gap-2"
      >
        {[
          { prayed: true, label: "Prayed" },
          { prayed: false, label: "Missed" },
        ].map((option) => {
          const selected = answer === option.prayed;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChoose(option.prayed)}
              className={`min-h-12 flex-1 rounded-md border text-meta font-medium transition-colors ${
                selected
                  ? option.prayed
                    ? "border-done bg-done-wash text-done"
                    : "border-line-strong bg-surface-3 text-ink-2"
                  : "border-line bg-surface-2 text-ink-3 hover:text-ink-2"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
