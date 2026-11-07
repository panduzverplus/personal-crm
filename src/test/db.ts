import { sql } from "drizzle-orm";
import { db } from "@/db";
import { isTestDatabaseName } from "./test-database-url";

async function currentDatabaseName() {
  const rows = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  return rows[0].name;
}

/** Throws unless the app code is connected to a `_test` database. */
export async function assertTestDatabase() {
  const name = await currentDatabaseName();
  if (!isTestDatabaseName(name)) {
    throw new Error(
      `Refusing to touch "${name}": its name does not end with "_test"`,
    );
  }
}

/** Empties every table of the test database and restarts id counters. */
export async function resetDatabase() {
  await assertTestDatabase();

  const tables = await db.execute<{ name: string }>(
    sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) {
    return;
  }
  const names = tables.map((table) => table.name).join(", ");
  await db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
}
