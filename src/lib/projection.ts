/**
 * Turning an unbounded pile into a schedule the user chose.
 *
 * Everything here is deliberately plain arithmetic: at N a day, a backlog of M
 * takes ceil(M / N) days. No smoothing, no estimates from past pace — the user
 * picks the number, so the date is theirs and stays honest.
 */

export const MIN_GOAL = 1;
export const MAX_GOAL = 20;

export function clampGoal(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(value)));
}

export function finishDate(outstanding: number, perDay: number, from = new Date()): Date | null {
  const goal = clampGoal(perDay);
  if (outstanding <= 0) return null;
  const days = Math.ceil(outstanding / goal);
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Formatted in the account's timezone, not the runtime's. Without an explicit
 * zone the server (UTC) and a browser further east render different dates for
 * the same instant, which both misreports the date and breaks hydration.
 */
export function formatFinishDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "At 2 a day, you'll finish around 14 March 2027." */
export function projectionSentence(
  outstanding: number,
  perDay: number,
  timeZone: string,
): string | null {
  const date = finishDate(outstanding, perDay);
  if (!date) return null;
  return `At ${clampGoal(perDay)} a day, you'll finish around ${formatFinishDate(date, timeZone)}.`;
}

/**
 * The nearest reachable milestone, so early progress has something concrete to
 * aim at instead of a demoralizing percentage.
 */
export function milestone(
  completed: number,
  outstanding: number,
  perDayInADay: number,
): string | null {
  if (outstanding <= 0) return null;

  const marks: { at: number; label: string }[] = [
    { at: perDayInADay * 7, label: "your first week" },
    { at: perDayInADay * 30, label: "your first month" },
    { at: 100, label: "100 prayers" },
    { at: 250, label: "250 prayers" },
    { at: 500, label: "500 prayers" },
    { at: 1000, label: "1,000 prayers" },
    { at: 2500, label: "2,500 prayers" },
    { at: 5000, label: "5,000 prayers" },
  ].sort((a, b) => a.at - b.at);

  for (const mark of marks) {
    if (completed < mark.at) {
      const remaining = mark.at - completed;
      if (remaining > outstanding) continue;
      return `${remaining.toLocaleString()} more and you've cleared ${mark.label}.`;
    }
  }
  return null;
}
