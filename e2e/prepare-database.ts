import { createMigratedDatabase, TEST_OWNER_EMAIL } from "../src/test/migrated-database";

// Runs before the e2e server starts: a fresh database with every migration applied.
// DATABASE_URL and OWNER_EMAIL are set by webServer.env in playwright.config.ts.
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL for e2e tests is not set");
  }
  await createMigratedDatabase(databaseUrl, {
    ownerEmail: process.env.OWNER_EMAIL ?? TEST_OWNER_EMAIL,
  });
}

main().catch((error) => {
  console.error("Failed to prepare the e2e database:", error);
  process.exitCode = 1;
});
