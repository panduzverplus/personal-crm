import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { applyMigrations, dropTestDatabase, recreateDatabase } from "@/test/migrated-database";

// The migration that gives existing data to its owner is checked on a database that is first
// brought to the state before login (migration 0004) and filled with data.
const migrationDatabaseUrl = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = url.pathname.replace(/_test$/, "_owner_migration_test");
  return url.toString();
})();

const BEFORE_LOGIN = "0004_default_groups";
const OWNER_MIGRATION = "0005_owner_ids.sql";

// Every test recreates a database and migrates it, which can take several seconds on a slow Docker.
describe("owner migration", { timeout: 60_000 }, () => {
  let client: postgres.Sql;

  async function rowCounts() {
    const [row] = await client`
      select
        (select count(*) from contacts)::int as contacts,
        (select count(*) from notes)::int as notes,
        (select count(*) from groups)::int as groups,
        (select count(*) from contact_groups)::int as contact_groups`;
    return row;
  }

  async function fillBeforeLogin() {
    await client`insert into contacts (name) values ('Анна Смирнова'), ('Борис Петров'), ('Вера Орлова')`;
    await client`insert into notes (contact_id, body) values (1, 'Первая'), (1, 'Вторая'), (2, 'Третья')`;
    await client`insert into groups (name) values ('Коллеги')`;
    // Five default groups come from migration 0004, "Коллеги" is the sixth.
    await client`insert into contact_groups (contact_id, group_id) values (1, 1), (1, 6), (2, 4)`;
  }

  beforeEach(async () => {
    await recreateDatabase(migrationDatabaseUrl);
    await applyMigrations(migrationDatabaseUrl, { upTo: BEFORE_LOGIN });
    client = postgres(migrationDatabaseUrl, { max: 1, onnotice: () => {} });
    await fillBeforeLogin();
  }, 60_000);

  afterEach(async () => {
    await client.end();
  });

  afterAll(async () => {
    await dropTestDatabase(migrationDatabaseUrl);
  });

  it("gives every contact and group to the owner and loses no rows", async () => {
    const before = await rowCounts();
    expect(before).toEqual({ contacts: 3, notes: 3, groups: 6, contact_groups: 3 });

    await applyMigrations(migrationDatabaseUrl, { ownerEmail: "owner@example.com" });

    expect(await rowCounts()).toEqual(before);
    const users = await client`select id, email, email_verified from users`;
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("owner@example.com");
    expect(users[0].email_verified).toBe(true);
    const foreign = await client`
      select
        (select count(*) from contacts where owner_id is distinct from ${users[0].id})::int as contacts,
        (select count(*) from groups where owner_id is distinct from ${users[0].id})::int as groups`;
    expect(foreign[0]).toEqual({ contacts: 0, groups: 0 });
  });

  it("keeps the default groups and their contacts with the owner", async () => {
    await applyMigrations(migrationDatabaseUrl, { ownerEmail: "owner@example.com" });

    const rows = await client`
      select g.name, count(cg.contact_id)::int as contacts
      from groups g left join contact_groups cg on cg.group_id = g.id
      group by g.id order by g.id`;
    expect(rows.map((row) => [row.name, row.contacts])).toEqual([
      ["Семья", 1],
      ["Друзья", 0],
      ["Знакомые", 0],
      ["Теннис", 1],
      ["Аналитики", 0],
      ["Коллеги", 1],
    ]);
  });

  it("trims and lowercases the owner email", async () => {
    await applyMigrations(migrationDatabaseUrl, { ownerEmail: "  Owner@Example.COM  " });

    const users = await client`select email from users`;
    expect(users.map((user) => user.email)).toEqual(["owner@example.com"]);
  });

  it("fails without the owner email and leaves the database as it was", async () => {
    const before = await rowCounts();

    await expect(applyMigrations(migrationDatabaseUrl, { ownerEmail: null })).rejects.toThrow(
      /OWNER_EMAIL is not set/,
    );

    expect(await rowCounts()).toEqual(before);
    const [found] = await client`select to_regclass('public.users') as found`;
    expect(found.found).toBeNull();
    const [owner] = await client`
      select count(*)::int as total from information_schema.columns
      where table_name = 'contacts' and column_name = 'owner_id'`;
    expect(owner.total).toBe(0);
    const [applied] = await client`select count(*)::int as total from drizzle.__drizzle_migrations`;
    expect(applied.total).toBe(5);
  });

  it("does not create a second user when the owner already exists", async () => {
    await applyMigrations(migrationDatabaseUrl, { ownerEmail: "owner@example.com" });
    const [owner] = await client`select id from users`;

    // Run the data step of the migration once more on rows without an owner.
    await client`alter table contacts alter column owner_id drop not null`;
    await client`alter table groups alter column owner_id drop not null`;
    await client`update contacts set owner_id = null`;
    await client`update groups set owner_id = null`;
    const migration = await readFile(path.resolve("drizzle", OWNER_MIGRATION), "utf8");
    const dataStep = migration.split("--> statement-breakpoint").find((part) => /DO \$/.test(part));
    expect(dataStep).toBeDefined();
    await client.begin(async (tx) => {
      await tx`select set_config('app.owner_email', 'OWNER@example.com ', true)`;
      await tx.unsafe(dataStep!);
    });

    const users = await client`select id from users`;
    expect(users).toEqual([{ id: owner.id }]);
    const [unowned] = await client`
      select (select count(*) from contacts where owner_id = ${owner.id})::int as contacts,
             (select count(*) from groups where owner_id = ${owner.id})::int as groups`;
    expect(unowned).toEqual({ contacts: 3, groups: 6 });
  });
});
