import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { applyMigrations, dropTestDatabase, recreateDatabase } from "./migrated-database";

// A throwaway database: the shared test database is emptied by other tests.
const helperDatabaseUrl = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = url.pathname.replace(/_test$/, "_helper_test");
  return url.toString();
})();

describe("migration helper", () => {
  let client: postgres.Sql;

  async function tableExists(name: string) {
    const rows = await client`select to_regclass(${`public.${name}`}) as found`;
    return rows[0].found !== null;
  }

  beforeAll(async () => {
    await recreateDatabase(helperDatabaseUrl);
    client = postgres(helperDatabaseUrl, { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await client.end();
    await dropTestDatabase(helperDatabaseUrl);
  });

  it("applies migrations only up to the given one", async () => {
    await applyMigrations(helperDatabaseUrl, { upTo: "0004_default_groups" });

    expect(await tableExists("groups")).toBe(true);
    expect(await tableExists("users")).toBe(false);
  });

  it("applies the rest of the migrations on top of the first part", async () => {
    await applyMigrations(helperDatabaseUrl);

    expect(await tableExists("users")).toBe(true);
  });

  it("refuses a migration that is not in the journal", async () => {
    await expect(applyMigrations(helperDatabaseUrl, { upTo: "9999_missing" })).rejects.toThrow(
      /not in the journal/,
    );
  });
});
