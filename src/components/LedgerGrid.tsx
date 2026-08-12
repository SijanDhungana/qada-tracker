"use client";

import { useRef } from "react";
import { dayLabel } from "@/lib/prayers";

export type GridDay = {
  id: string;
  dayIndex: number;
  dayDate: string | null;
  done: number;
  total: number;
};

/**
 * One cell per day — the whole backlog visible at once, and visibly shrinking.
 *
 * A partial day fills proportionally from the bottom like a vessel rather than
 * taking a different colour, which is what makes progress readable on a day
 * nobody has finished yet.
 */
export function LedgerGrid({
  days,
  targetId,
  onSelect,
  compact = false,
}: {
  days: GridDay[];
  /** The oldest incomplete day — where the next log will land. */
  targetId?: string | null;
  onSelect?: (day: GridDay) => void;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);

  // One tab stop for the whole grid, arrow keys to move within it.
  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>, index: number) {
    const cells = container.current?.querySelectorAll<HTMLButtonElement>("[data-cell]");
    if (!cells?.length) return;

    const styles = getComputedStyle(container.current!);
    const columns = styles.gridTemplateColumns.split(" ").length || 1;

    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    };

    const delta = moves[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    const next = Math.min(Math.max(index + delta, 0), cells.length - 1);
    cells[next]?.focus();
  }

  return (
    <div
      ref={container}
      role="grid"
      aria-label="Every tracked day"
      className="grid gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 14 : 16}px, 1fr))`,
      }}
    >
      {days.map((day, index) => {
        const complete = day.total > 0 && day.done >= day.total;
        const fraction = day.total > 0 ? day.done / day.total : 0;
        const isTarget = day.id === targetId;
        const label = `${dayLabel(day)}, ${day.done} of ${day.total} logged`;

        return (
          <button
            key={day.id}
            data-cell
            type="button"
            role="gridcell"
            title={`${dayLabel(day)} · ${day.done} of ${day.total}`}
            aria-label={label}
            tabIndex={index === 0 ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onSelect?.(day)}
            className="relative aspect-square overflow-hidden rounded-cell bg-surface-2"
            style={
              isTarget
                ? { boxShadow: "inset 0 0 0 2px var(--today)" }
                : undefined
            }
          >
            {fraction > 0 ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 block transition-[height] duration-[var(--slow)] ease-[var(--ease)]"
                style={{
                  height: `${Math.round(fraction * 100)}%`,
                  backgroundColor: complete ? "var(--done)" : "var(--done-2)",
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function GridLegend({ className = "" }: { className?: string }) {
  const items = [
    { label: "Untouched", style: { backgroundColor: "var(--surface-2)" } },
    { label: "Part done", style: { backgroundColor: "var(--done-2)" } },
    { label: "Cleared", style: { backgroundColor: "var(--done)" } },
    { label: "Next up", style: { boxShadow: "inset 0 0 0 2px var(--today)" } },
  ];

  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-meta text-ink-3">
          <span
            aria-hidden="true"
            className="size-3 rounded-cell bg-surface-2"
            style={item.style}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
