import { closeDb, db } from "../src/server/db";
import { seedDatabase } from "../src/server/db/seed";

(async () => {
  try {
    await seedDatabase(db, { log: console.log });
  } catch (e) {
    console.error("✘ seed failed:", e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
