import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import type postgres from "postgres";

// `next build` loads the modules of the app without any database settings and never queries the
// database. So loading `@/db` must not read the settings: the first query does.

const globalForDb = globalThis as unknown as { postgresClient?: postgres.Sql };

function withoutDatabaseSettings() {
  for (const name of ["DATABASE_URL", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"]) {
    vi.stubEnv(name, "");
  }
}

beforeEach(() => {
  vi.resetModules();
  // `@/db` keeps its client on globalThis outside production: start every test without one.
  delete globalForDb.postgresClient;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await globalForDb.postgresClient?.end();
  delete globalForDb.postgresClient;
});

describe("database connection", () => {
  it("does not need the database settings to load the module", async () => {
    withoutDatabaseSettings();

    const { db } = await import("@/db");

    // The settings are read by the first query, which tells what is missing.
    await expect((async () => db.execute(sql`select 1`))()).rejects.toThrow(
      /Database is not configured/,
    );
  });

  it("does not need the database settings to load the login module", async () => {
    withoutDatabaseSettings();

    const { auth } = await import("@/lib/auth");

    // Better Auth sets itself up right when the module is loaded: wait for it to finish.
    await expect(auth.$context).resolves.toBeDefined();
  });

  it("connects on the first query and reuses the connection", async () => {
    const { db } = await import("@/db");

    const rows = await db.execute<{ one: number }>(sql`select 1 as one`);
    expect(rows[0].one).toBe(1);
    expect(db.$client).toBe(db.$client);
    expect(globalForDb.postgresClient).toBe(db.$client);
  });
});
