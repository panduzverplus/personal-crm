import { loadEnvConfig } from "@next/env";
import { createPostgresClient } from "./client";
import { runMigrations } from "./run-migrations";

// Applies drizzle/ migrations (on the server before a new image starts: deploy/deploy.sh).
// Exits with code 1 on failure, so the deploy stops and the old image keeps running.
// OWNER_EMAIL is needed by the migration that gives existing data to its owner.
async function main() {
  loadEnvConfig(process.cwd());

  const client = createPostgresClient({ max: 1, onnotice: () => {} });
  try {
    await runMigrations(client, { ownerEmail: process.env.OWNER_EMAIL });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
