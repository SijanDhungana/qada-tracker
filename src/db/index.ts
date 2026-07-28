import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

/**
 * The Vercel/Neon marketplace integration injects the connection string for us.
 * Depending on how the integration is configured the variable is named
 * DATABASE_URL or POSTGRES_URL, so accept whichever is present.
 */
export function getConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED;

  if (!url) {
    throw new Error(
      "No Postgres connection string found. Set DATABASE_URL (the Vercel Neon integration normally injects this for you).",
    );
  }
  return url;
}

// Reuse the client across hot reloads and warm lambdas instead of opening a new
// pool per request.
const globalForDb = globalThis as unknown as { qadaDb?: Database };

function connect(): Database {
  if (!globalForDb.qadaDb) {
    globalForDb.qadaDb = drizzle(
      postgres(getConnectionString(), { max: 1, prepare: false }),
      { schema },
    );
  }
  return globalForDb.qadaDb;
}

/**
 * Connecting is deferred to the first query. `next build` imports this module
 * while collecting page data, and we don't want a build to fail just because
 * the database env var isn't present in the build environment.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const instance = connect();
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
