"use client";

import { useEffect, useState } from "react";
import { PRAYER_LABELS, type DailyPrayerKey } from "@/lib/prayers";
import {
  MASJID_STATUSES,
  MAX_REASON_LENGTH,
  REASON_SUGGESTIONS,
  STATUS_LABELS,
  STATUS_SHORT,
  type MasjidStatus,
} from "@/lib/masjid";
import { formatDateKey } from "@/lib/time";
import { Sheet } from "./ui/Sheet";

export type EditorTarget = {
  dateKey: string;
  prayer: DailyPrayerKey;
  /** Whatever is currently recorded, so the sheet opens on it. */
  status?: MasjidStatus;
  reason?: string | null;
  /** Today's sheet skips straight to the note; past days pick a status too. */
  askStatus: boolean;
};

const STATUS_STYLES: Record<MasjidStatus, string> = {
  masjid: "border-done bg-done-wash text-done",
  alone: "border-line-strong bg-surface-3 text-ink",
  missed: "border-line-strong bg-surface-3 text-ink-2",
};

/**
 * One sheet for recording where a prayer was prayed, used both for today and
 * for correcting an earlier day. A note only makes sense when the answer isn't
 * "at the masjid", so the field appears and disappears with the choice.
 */
export function MasjidEditorSheet({
  target,
  onClose,
  onSave,
  onClear,
}: {
  target: EditorTarget | null;
  onClose: () => void;
  onSave: (status: MasjidStatus, reason: string | null) => void;
  onClear?: () => void;
}) {
  const [status, setStatus] = useState<MasjidStatus>("masjid");
  const [reason, setReason] = useState("");

  // Re-seed whenever a different prayer is opened.
  useEffect(() => {
    if (!target) return;
    setStatus(target.status ?? "masjid");
    setReason(target.reason ?? "");
  }, [target]);

  const wantsReason = status !== "masjid";

  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target ? PRAYER_LABELS[target.prayer] : ""}
      description={
        target
          ? target.askStatus
            ? formatDateKey(target.dateKey)
            : `${STATUS_LABELS[status].toLowerCase()} · add a note if it helps you spot a pattern. You can skip this.`
          : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {target?.askStatus ? (
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
                onClick={() => setStatus(option)}
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
        ) : null}

        {wantsReason ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {REASON_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    setReason((current) => (current === suggestion ? "" : suggestion))
                  }
                  aria-pressed={reason === suggestion}
                  className={`min-h-11 rounded-md border px-3 text-meta font-medium transition-colors ${
                    reason === suggestion
                      ? "border-brand bg-brand-wash text-brand"
                      : "border-line bg-surface-2 text-ink-2 hover:text-ink"
                  }`}
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
                className="min-h-12 w-full rounded-md border border-line bg-surface-2 px-3 text-body
                           text-ink outline-none placeholder:text-ink-3 focus:border-brand"
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          {target?.askStatus && onClear && target.status ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-12 rounded-md border border-line px-4 text-body font-medium text-ink-3 hover:bg-surface-2"
            >
              Clear
            </button>
          ) : null}

          {!target?.askStatus ? (
            <button
              type="button"
              onClick={() => onSave(status, null)}
              className="min-h-12 flex-1 rounded-md border border-line text-body font-medium text-ink-2 hover:bg-surface-2"
            >
              Skip
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onSave(status, wantsReason ? reason.trim() || null : null)}
            className="min-h-12 flex-1 rounded-md bg-brand text-body font-semibold text-done-ink"
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
