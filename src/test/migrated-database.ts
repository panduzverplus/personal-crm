import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  getDatabaseName,
  getMaintenanceDatabaseUrl,
  isTestDatabaseName,
} from "./test-database-url";

// Relative imports only: global-setup.ts runs this before the "@/" alias is guaranteed.

/** Drops the database if it exists and creates it again with every migration applied. */
export async function createMigratedDatabase(databaseUrl: string) {
  const name = getDatabaseName(databaseUrl);
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to recreate "${name}": not a test database`);
  }

  const maintenance = postgres(getMaintenanceDatabaseUrl(databaseUrl), {
    max: 1,
    onnotice: () => {},
  });
  try {
    // Identifiers cannot be parameters; the name is checked above and quoted here.
    const quoted = `"${name.replaceAll('"', '""')}"`;
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
    await maintenance.unsafe(`CREATE DATABASE ${quoted}`);
  } finally {
    await maintenance.end();
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}

/** Drops a database created by `createMigratedDatabase`. */
export async function dropTestDatabase(databaseUrl: string) {
  const name = getDatabaseName(databaseUrl);
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to drop "${name}": not a test database`);
  }

  const maintenance = postgres(getMaintenanceDatabaseUrl(databaseUrl), {
    max: 1,
    onnotice: () => {},
  });
  try {
    const quoted = `"${name.replaceAll('"', '""')}"`;
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
  } finally {
    await maintenance.end();
  }
}
