import type { TestProject } from "vitest/node";
import { createMigratedDatabase } from "./migrated-database";

// Runs once before all tests: a fresh `<POSTGRES_DB>_test` database with every migration applied.
export default async function setup(project: TestProject) {
  const databaseUrl = project.config.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL for tests is not set in vitest.config.ts");
  }
  await createMigratedDatabase(databaseUrl);
}
