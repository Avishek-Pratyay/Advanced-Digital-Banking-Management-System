/**
 * Database access.
 *
 *  - DATABASE_URL = postgres://...  -> PostgreSQL through postgres-js (production, Vercel, Neon, Supabase...)
 *  - DATABASE_URL empty / "pglite"  -> embedded PostgreSQL (PGlite) persisted in ./.data/pglite
 *                                      (zero-setup local development & automated tests)
 *
 * Both drivers speak real PostgreSQL, so row locks (SELECT ... FOR UPDATE) and
 * interactive transactions behave identically.
 */
import { PGlite } from "@electric-sql/pglite";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
/** A database handle or an open transaction - both expose the same query API. */
export type DbLike = Database;

type Handle = { db: Database; kind: "postgres" | "pglite"; close: () => Promise<void> };

const globalForDb = globalThis as unknown as { __vaultlineDb?: Handle };

export function usesPglite(url = process.env.DATABASE_URL): boolean {
  return !url || url === "pglite" || url.startsWith("pglite:");
}

function create(url = process.env.DATABASE_URL): Handle {
  if (usesPglite(url)) {
    // "pglite:memory" -> throw-away in-memory database (tests); "pglite:<dir>" -> custom folder
    const custom = url?.startsWith("pglite:") ? url.slice("pglite:".length) : "";
    let client: PGlite;
    if (custom === "memory") client = new PGlite();
    else {
      const dir = custom || path.join(process.cwd(), ".data", "pglite");
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      client = new PGlite(dir);
    }
    return { db: drizzlePglite(client, { schema }) as unknown as Database, kind: "pglite", close: () => client.close() };
  }
  const client = postgres(url!, {
    max: process.env.VERCEL ? 1 : 10, // serverless: one connection per lambda instance
    prepare: false, // required for pgbouncer / Supabase / Neon pooled connections
    idle_timeout: 20,
    ssl: /localhost|127\.0\.0\.1/.test(url!) ? false : "require",
  });
  return { db: drizzlePostgres(client, { schema }) as unknown as Database, kind: "postgres", close: () => client.end() };
}

function handle(): Handle {
  if (!globalForDb.__vaultlineDb) globalForDb.__vaultlineDb = create();
  return globalForDb.__vaultlineDb;
}

/** Lazily created singleton (survives Next.js hot reloads). */
export const db: Database = new Proxy({} as Database, {
  get(_t, prop, receiver) {
    return Reflect.get(handle().db as object, prop, receiver);
  },
});

/** Create an isolated in-memory database (used by the automated tests). */
export function createMemoryDb(): Handle {
  const client = new PGlite();
  return { db: drizzlePglite(client, { schema }) as unknown as Database, kind: "pglite", close: () => client.close() };
}

export const dbKind = () => handle().kind;

export async function closeDb() {
  if (globalForDb.__vaultlineDb) {
    await globalForDb.__vaultlineDb.close();
    globalForDb.__vaultlineDb = undefined;
  }
}

export { schema };
