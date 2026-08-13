/**
 * The day boundary.
 *
 * "Today" has to mean one thing everywhere — the same midnight-to-midnight
 * window on the server that computes your counts and in the browser that draws
 * them. Before this, the server used its own clock (UTC on Vercel) and the
 * browser used the device's, so a prayer logged late at night could land on
 * different days in the two halves of the app.
 *
 * Everything now derives from the timezone stored on the account.
 */

export const DEFAULT_TIMEZONE = "America/Toronto";

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(value: unknown): string {
  return isValidTimezone(value) ? value : DEFAULT_TIMEZONE;
}

/** The calendar date in `timeZone` as YYYY-MM-DD. en-CA formats in that order. */
export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimezone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayKeyInZone(timeZone: string, now = new Date()): string {
  return dateKeyInZone(now, timeZone);
}

/** How far `timeZone` is from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Intl can render midnight as hour 24 in some locales' hourCycle.
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return asIfUtc - instant.getTime();
}

/**
 * The exact instant midnight begins on `dateKey` in `timeZone`.
 * Offsets are resolved twice so days that cross a DST change land correctly.
 */
export function startOfDayInZone(dateKey: string, timeZone: string): Date {
  const zone = normalizeTimezone(timeZone);
  const [year, month, day] = dateKey.split("-").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);

  const firstGuess = naiveUtc - zoneOffsetMs(new Date(naiveUtc), zone);
  const corrected = naiveUtc - zoneOffsetMs(new Date(firstGuess), zone);

  return new Date(corrected);
}

export function startOfTodayInZone(timeZone: string, now = new Date()): Date {
  return startOfDayInZone(todayKeyInZone(timeZone, now), timeZone);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** "Sat 12 Aug" — day headings in the history list. */
export function formatDateKey(dateKey: string, withWeekday = true): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A clock time rendered in the account's timezone, not the device's. */
export function formatTimeInZone(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: normalizeTimezone(timeZone),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Toronto · 14:32" — shown next to the timezone picker so the choice is legible. */
export function describeZone(timeZone: string, now = new Date()): string {
  const zone = normalizeTimezone(timeZone);
  const city = zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  return `${city} · ${time}`;
}

/** Every zone the runtime knows, for the Settings picker. */
export function supportedTimezones(): string[] {
  const withValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    const zones = withValues.supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) return zones;
  } catch {
    /* fall through to the short list */
  }
  return [
    DEFAULT_TIMEZONE,
    "America/Vancouver",
    "America/Edmonton",
    "America/Winnipeg",
    "America/Halifax",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Dublin",
    "Europe/Paris",
    "Europe/Istanbul",
    "Africa/Cairo",
    "Asia/Riyadh",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Dhaka",
    "Asia/Jakarta",
    "Asia/Kuala_Lumpur",
    "Australia/Sydney",
    "UTC",
  ];
}
