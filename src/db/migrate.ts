import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, createPostgresClient } from "./client";

// Applies drizzle/ migrations on the server before a new image starts (deploy/deploy.sh).
// Exits with code 1 on failure, so the deploy stops and the old image keeps running.
async function main() {
  loadEnvConfig(process.cwd());

  const client = createPostgresClient({ max: 1, onnotice: () => {} });
  try {
    await migrate(createDb(client), { migrationsFolder: "drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
