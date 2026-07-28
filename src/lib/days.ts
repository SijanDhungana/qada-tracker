export const MAX_DAYS_PER_REQUEST = 20000; // ~55 years — a sane upper bound

export type NewDay = { dayDate: string | null };

export type ParseResult =
  | { ok: true; days: NewDay[] }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject things like 2025-02-31, which Date would silently roll over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Option A — every calendar date from start to end, inclusive. */
export function daysFromDateRange(start: string, end: string): ParseResult {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);

  if (!startDate || !endDate) {
    return { ok: false, error: "Please pick a valid start and end date." };
  }
  if (endDate < startDate) {
    return { ok: false, error: "The end date must be on or after the start date." };
  }

  const count =
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  if (count > MAX_DAYS_PER_REQUEST) {
    return {
      ok: false,
      error: `That's ${count.toLocaleString()} days. Please add at most ${MAX_DAYS_PER_REQUEST.toLocaleString()} days at a time.`,
    };
  }

  const days: NewDay[] = [];
  for (let i = 0; i < count; i++) {
    days.push({ dayDate: toIsoDate(new Date(startDate.getTime() + i * 86_400_000)) });
  }
  return { ok: true, days };
}

export const UNITS = ["days", "weeks", "months"] as const;
export type Unit = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

/** Option B — a plain count, with no calendar dates attached. */
export function daysFromAmount(amount: number, unit: Unit): ParseResult {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) {
    return { ok: false, error: "Please enter a whole number of 1 or more." };
  }

  const multiplier = unit === "weeks" ? 7 : unit === "months" ? 30 : 1;
  const count = amount * multiplier;

  if (count > MAX_DAYS_PER_REQUEST) {
    return {
      ok: false,
      error: `That's ${count.toLocaleString()} days. Please add at most ${MAX_DAYS_PER_REQUEST.toLocaleString()} days at a time.`,
    };
  }

  return { ok: true, days: Array.from({ length: count }, () => ({ dayDate: null })) };
}
