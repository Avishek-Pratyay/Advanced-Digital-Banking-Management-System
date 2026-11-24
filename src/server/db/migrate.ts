import path from "node:path";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { db, dbKind, type Database } from "./index";

/** Apply the SQL migrations in ./drizzle to whichever database is configured. */
export async function runMigrations(target: Database = db, kind: "postgres" | "pglite" = dbKind()) {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (kind === "pglite") await migratePglite(target as never, { migrationsFolder });
  else await migratePostgres(target as never, { migrationsFolder });
}
