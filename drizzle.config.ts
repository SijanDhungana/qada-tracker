import { readFileSync } from "node:fs";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit runs outside Next.js, so it doesn't pick up .env files on its own.
 * `vercel env pull .env.local` drops the injected Postgres URL into .env.local,
 * and this reads it back so `npm run db:migrate` works with no extra setup.
 */
function loadEnvFile(path: string) {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED;

if (!url) {
  throw new Error(
    "No Postgres connection string found. Run `vercel env pull .env.local` first, or set DATABASE_URL yourself. See SETUP.md.",
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
} satisfies Config;
