import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  createMigratedDatabase,
  dropTestDatabase,
} from "@/test/migrated-database";

// Other tests empty the shared test database, so the seeded groups are checked
// in their own throwaway database that has only been migrated.
const seedDatabaseUrl = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = url.pathname.replace(/_test$/, "_seed_test");
  return url.toString();
})();

describe("default groups", () => {
  let client: postgres.Sql;

  beforeAll(async () => {
    await createMigratedDatabase(seedDatabaseUrl);
    client = postgres(seedDatabaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await client.end();
    await dropTestDatabase(seedDatabaseUrl);
  });

  it("exist right after the migrations", async () => {
    const rows = await client`select name from groups`;
    expect(rows.map((row) => row.name).sort()).toEqual(
      ["Аналитики", "Друзья", "Знакомые", "Семья", "Теннис"].sort(),
    );
  });

  it("start without contacts", async () => {
    const rows = await client`select count(*)::int as total from contact_groups`;
    expect(rows[0].total).toBe(0);
  });
});
