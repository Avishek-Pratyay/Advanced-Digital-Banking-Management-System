import { sql } from "drizzle-orm";
import { closeDb, db } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { seedDatabase } from "../src/server/db/seed";

/** Drops every table/enum, re-applies the migrations and reseeds demo data. */
(async () => {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") throw new Error("Refusing to reset a production database (set ALLOW_DB_RESET=true to override)");
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations();
    await seedDatabase(db, { log: console.log });
  } catch (e) {
    console.error("✘ reset failed:", e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
