import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { runMigrations } from "../db/run-migrations";
import {
  getDatabaseName,
  getMaintenanceDatabaseUrl,
  isTestDatabaseName,
} from "./test-database-url";

// Relative imports only: global-setup.ts runs this before the "@/" alias is guaranteed.

/** Owner of the data that exists before login, in every database the tests create. */
export const TEST_OWNER_EMAIL = "owner@example.com";

type MigrationOptions = {
  /** Email of the owner of existing data; default: `TEST_OWNER_EMAIL`. `null` — not set at all. */
  ownerEmail?: string | null;
  /** Apply migrations only up to this tag, inclusive (for example "0004_default_groups"). */
  upTo?: string;
};

function quoteIdentifier(name: string) {
  // Identifiers cannot be parameters; the name is checked by the callers and quoted here.
  return `"${name.replaceAll('"', '""')}"`;
}

/** Drops the database if it exists and creates it again, empty. */
export async function recreateDatabase(databaseUrl: string) {
  const name = getDatabaseName(databaseUrl);
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to recreate "${name}": not a test database`);
  }

  const maintenance = postgres(getMaintenanceDatabaseUrl(databaseUrl), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`);
    await maintenance.unsafe(`CREATE DATABASE ${quoteIdentifier(name)}`);
  } finally {
    await maintenance.end();
  }
}

/**
 * Copies `drizzle/` into a temporary folder whose journal stops at `tag`, runs `fn` with that
 * folder and deletes it. The migrator only knows the migrations that the journal lists.
 */
async function withMigrationsUpTo<T>(tag: string, fn: (folder: string) => Promise<T>) {
  const source = path.resolve("drizzle");
  const journal = JSON.parse(await readFile(path.join(source, "meta", "_journal.json"), "utf8"));
  const lastIndex = journal.entries.findIndex((entry: { tag: string }) => entry.tag === tag);
  if (lastIndex === -1) {
    throw new Error(`Migration "${tag}" is not in the journal`);
  }
  journal.entries = journal.entries.slice(0, lastIndex + 1);

  const folder = await mkdtemp(path.join(os.tmpdir(), "crm-migrations-"));
  try {
    await mkdir(path.join(folder, "meta"));
    await writeFile(path.join(folder, "meta", "_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries as { tag: string }[]) {
      await cp(path.join(source, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
    }
    return await fn(folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

/** Applies the migrations that the database does not have yet. */
export async function applyMigrations(databaseUrl: string, options: MigrationOptions = {}) {
  const name = getDatabaseName(databaseUrl);
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to migrate "${name}": not a test database`);
  }

  const ownerEmail = options.ownerEmail === undefined ? TEST_OWNER_EMAIL : options.ownerEmail;
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const run = (migrationsFolder?: string) =>
      runMigrations(client, { ownerEmail: ownerEmail ?? undefined, migrationsFolder });
    if (options.upTo) {
      await withMigrationsUpTo(options.upTo, (folder) => run(folder));
    } else {
      await run();
    }
  } finally {
    await client.end();
  }
}

/** Drops the database if it exists and creates it again with every migration applied. */
export async function createMigratedDatabase(databaseUrl: string, options: MigrationOptions = {}) {
  await recreateDatabase(databaseUrl);
  await applyMigrations(databaseUrl, options);
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
    await maintenance.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`);
  } finally {
    await maintenance.end();
  }
}
