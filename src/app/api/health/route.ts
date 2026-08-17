import { sql } from "drizzle-orm";
import { db } from "@/db";

// bcryptjs and the Postgres driver both need Node.js APIs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A setup check you can open in a browser: /api/health
 *
 * It reports which piece of configuration is missing in plain language. It
 * deliberately never echoes a secret or a connection string — only whether one
 * is present, and which environment variable it came from.
 */

const CONNECTION_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
] as const;

/** Strip anything that could carry a password out of a driver error message. */
function redact(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']*/gi, "postgres://[redacted]")
    .replace(/password[^\s,;]*/gi, "password=[redacted]");
}

/**
 * Drizzle wraps driver errors in a generic "Failed query" message and hides the
 * useful part (ECONNREFUSED, password authentication failed, …) on `cause`.
 */
function describe(error: unknown): string {
  const parts: string[] = [];
  let current = error;

  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const code = (current as { code?: string }).code;
    parts.push(code ? `${current.message} (${code})` : current.message);
    current = current.cause;
  }

  if (parts.length === 0) parts.push(String(error));
  // The innermost cause is the informative one; lead with it.
  return redact(parts.reverse().join(" ← ").replace(/\s+/g, " ").trim());
}

type Check = { name: string; ok: boolean; detail: string };

export async function GET() {
  const checks: Check[] = [];

  // 1. Is there a connection string at all?
  const foundVar = CONNECTION_VARS.find((name) => process.env[name]);
  checks.push({
    name: "Database connection string",
    ok: Boolean(foundVar),
    detail: foundVar
      ? `Found in ${foundVar}.`
      : "Not set. Provision Postgres from Vercel (SETUP.md, Step A), then redeploy.",
  });

  // 2. Is the login secret set?
  checks.push({
    name: "AUTH_SECRET",
    ok: Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
    detail: (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)
      ? "Set."
      : "Not set. Run `npx auth secret`, then `vercel env add AUTH_SECRET` for Production, and redeploy (SETUP.md, Step B).",
  });

  // 3. Can we actually reach the database?
  let reachable = false;
  if (foundVar) {
    try {
      await db.execute(sql`select 1`);
      reachable = true;
      checks.push({
        name: "Database reachable",
        ok: true,
        detail: "Connected successfully.",
      });
    } catch (error) {
      checks.push({
        name: "Database reachable",
        ok: false,
        detail: `Could not connect: ${describe(error)}`,
      });
    }
  }

  // 4. Have the migrations been run?
  if (reachable) {
    try {
      const rows = await db.execute<{ table_name: string }>(sql`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name in ('users', 'prayer_days')
      `);
      const present = new Set(Array.from(rows).map((row) => row.table_name));
      const missing = ["users", "prayer_days"].filter((t) => !present.has(t));
      checks.push({
        name: "Tables created",
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? "Both `users` and `prayer_days` exist."
            : `Missing: ${missing.join(", ")}. Run \`npm run db:migrate\` (SETUP.md, Step C).`,
      });
    } catch (error) {
      checks.push({
        name: "Tables created",
        ok: false,
        detail: describe(error),
      });
    }
  }

  // 5. Is the schema current? Existing tables alone aren't enough — a database
  //    left on an older migration has the right tables and the wrong columns,
  //    which fails at request time rather than here.
  if (reachable) {
    try {
      const rows = await db.execute<{ table_name: string; column_name: string }>(sql`
        select table_name, column_name from information_schema.columns
        where table_schema = 'public'
      `);

      const present = new Set(
        Array.from(rows).map((row) => `${row.table_name}.${row.column_name}`),
      );

      const required = [
        "prayer_days.fajr_at",
        "prayer_days.zuhr_at",
        "prayer_days.asr_at",
        "prayer_days.maghrib_at",
        "prayer_days.isha_at",
        "prayer_days.witr_at",
        "users.daily_goal",
        "users.theme",
        "users.timezone",
        "users.track_tahajjud",
        "users.track_tahajjud_rakahs",
        "users.track_sunnah",
        "masjid_prayers.timing",
        "masjid_prayers.joined_rakah",
        "tahajjud_nights.rakahs",
        "daily_witr.remade",
        "sunnah_log.part",
        "worship_log.count",
      ];
      const missing = required.filter((column) => !present.has(column));

      checks.push({
        name: "Schema up to date",
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? "All columns this version needs are present."
            : `${missing.length} missing (e.g. ${missing[0]}). Run the newest migration — \`npm run db:migrate\`, or paste the newest file in drizzle/ into Neon's SQL Editor.`,
      });
    } catch (error) {
      checks.push({
        name: "Schema up to date",
        ok: false,
        detail: describe(error),
      });
    }
  }

  const ok = checks.every((check) => check.ok);
  const firstProblem = checks.find((check) => !check.ok);

  return Response.json(
    {
      ok,
      summary: ok
        ? "Everything is configured. Signup should work."
        : `Setup incomplete — ${firstProblem?.name}: ${firstProblem?.detail}`,
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
