import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type postgres from "postgres";

// Relative imports only: the test helpers and e2e/prepare-database.ts use this file too.

/** Name of the Postgres setting that carries the owner email to the ownership migration. */
export const OWNER_EMAIL_SETTING = "app.owner_email";

type RunMigrationsOptions = {
  /** Email of the user who gets every contact and group that exists before login. */
  ownerEmail?: string;
  migrationsFolder?: string;
};

/**
 * Applies the migrations of `migrationsFolder` (default `drizzle/`).
 *
 * `client` must be created with `max: 1`: the owner email is a session setting, so it has to be
 * set on the very connection that runs the migrations. Drizzle runs them in one transaction, so a
 * failed migration leaves the database as it was.
 */
export async function runMigrations(client: postgres.Sql, options: RunMigrationsOptions = {}) {
  const db = drizzle(client);
  const ownerEmail = options.ownerEmail?.trim();
  if (ownerEmail) {
    await db.execute(sql`select set_config(${OWNER_EMAIL_SETTING}, ${ownerEmail}, false)`);
  }
  await migrate(db, { migrationsFolder: options.migrationsFolder ?? "drizzle" });
}
