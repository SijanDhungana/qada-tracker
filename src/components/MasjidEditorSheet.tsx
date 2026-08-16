"use client";

import { useEffect, useState } from "react";
import { PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  MASJID_TIMINGS,
  MAX_REASON_LENGTH,
  REASON_SUGGESTIONS,
  STATUS_SHORT,
  TIMING_LABELS,
  rakahOptions,
  type MasjidStatus,
  type MasjidTiming,
} from "@/lib/masjid";
import { formatDateKey } from "@/lib/time";
import { Sheet } from "./ui/Sheet";

export type EditorTarget = {
  dateKey: string;
  prayer: DailyPrayerKey;
  status?: MasjidStatus;
  timing?: MasjidTiming | null;
  joinedRakah?: string | null;
  reason?: string | null;
  /** Today's strip pre-selects the status that was tapped; history picks it here. */
  askStatus: boolean;
};

export type EditorSave = {
  status: MasjidStatus;
  timing: MasjidTiming | null;
  joinedRakah: string | null;
  reason: string | null;
};

const STATUS_STYLES: Record<MasjidStatus, string> = {
  masjid: "border-done bg-done-wash text-done",
  alone: "border-line-strong bg-surface-3 text-ink",
  missed: "border-line-strong bg-surface-3 text-ink-2",
};

const chipBase =
  "min-h-11 rounded-md border px-3 text-meta font-medium transition-colors";
const chipOff =
  "border-line bg-surface-2 text-ink-2 hover:text-ink";
const chipOn = "border-brand bg-brand-wash text-brand";

/**
 * Records where a prayer was prayed and, at the masjid, whether the jama'ah was
 * caught from the start. Being late opens two more questions — which rak'ah you
 * joined at, and what held you up — because those are the two things that make
 * the record worth keeping rather than just a tally.
 */
export function MasjidEditorSheet({
  target,
  onClose,
  onSave,
  onClear,
}: {
  target: EditorTarget | null;
  onClose: () => void;
  onSave: (value: EditorSave) => void;
  onClear?: () => void;
}) {
  const [status, setStatus] = useState<MasjidStatus>("masjid");
  const [timing, setTiming] = useState<MasjidTiming | null>(null);
  const [rakah, setRakah] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!target) return;
    setStatus(target.status ?? "masjid");
    setTiming(target.timing ?? null);
    setRakah(target.joinedRakah ?? null);
    setReason(target.reason ?? "");
  }, [target]);

  if (!target) {
    // Keep the dialog mounted but closed so its open/close transition is stable.
    return (
      <Sheet open={false} onClose={onClose} title="">
        <div />
      </Sheet>
    );
  }

  const atMasjid = status === "masjid";
  const isLate = atMasjid && timing === "late";
  // A note explains being late, or not being at the masjid at all.
  const wantsReason = !atMasjid || isLate;
  // At the masjid you must say whether you made it from the start.
  const canSave = !atMasjid || timing !== null;

  function submit() {
    onSave({
      status,
      timing: atMasjid ? timing : null,
      joinedRakah: isLate ? rakah : null,
      reason: wantsReason ? reason.trim() || null : null,
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
        {target.askStatus ? (
          <div>
            <p className="mb-2 text-meta text-ink-2">Where did you pray it?</p>
            <div role="radiogroup" aria-label="Where was it prayed?" className="flex gap-2">
              {MASJID_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={status === option}
                  onClick={() => {
                    setStatus(option);
                    // Timing and rak'ah only exist at the masjid.
                    if (option !== "masjid") {
                      setTiming(null);
                      setRakah(null);
                    }
                  }}
                  className={`min-h-12 flex-1 rounded-md border px-2 text-meta font-medium transition-colors ${
                    status === option
                      ? STATUS_STYLES[option]
                      : "border-line bg-surface-2 text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {STATUS_SHORT[option]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {atMasjid ? (
          <div>
            <p className="mb-2 text-meta text-ink-2">Did you catch it from the start?</p>
            <div role="radiogroup" aria-label="On time or late?" className="flex gap-2">
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
                  className={`${chipBase} ${rakah === option.value ? chipOn : chipOff}`}
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
              {isLate ? "What held you up?" : "Add a note if it helps you spot a pattern."}
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
              <label htmlFor="masjid-reason" className="mb-1.5 block text-meta text-ink-2">
                Or write your own
              </label>
              <input
                id="masjid-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={MAX_REASON_LENGTH}
                placeholder="Optional"
                className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body
                           text-ink outline-none placeholder:text-ink-3 focus:border-brand"
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          {onClear && target.status ? (
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
