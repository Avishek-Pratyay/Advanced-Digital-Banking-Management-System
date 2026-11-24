import { closeDb, dbKind } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";

(async () => {
  try {
    await runMigrations();
    console.log(`✔ migrations applied (${dbKind()})`);
  } catch (e) {
    console.error("✘ migration failed:", e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
