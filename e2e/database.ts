import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { contacts } from "../src/db/schema";
import { getE2eDatabaseUrl } from "../src/test/test-database-url";

/** Leaves exactly these contacts, without notes, in the e2e database. */
export async function resetContacts(names: string[]) {
  const client = postgres(getE2eDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);
    await db.execute(sql`truncate table ${contacts} restart identity cascade`);
    await db.insert(contacts).values(names.map((name) => ({ name })));
  } finally {
    await client.end();
  }
}
