import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { contactGroups, contacts, groups, notes } from "../src/db/schema";
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

export type SeedContact = {
  name: string;
  frequency?: "week" | "month" | "quarter" | "year";
  createdAt?: Date;
  /** When the only note of the contact was written; no note when not set. */
  noteAt?: Date;
  group?: string;
};

/** Leaves exactly these contacts and their groups in the e2e database. Returns ids by group name. */
export async function seedContacts(people: SeedContact[], extraGroups: string[] = []) {
  const client = postgres(getE2eDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);
    await db.execute(sql`truncate table ${contacts}, ${groups} restart identity cascade`);

    const groupNames = [
      ...new Set([...people.flatMap(({ group }) => (group ? [group] : [])), ...extraGroups]),
    ];
    const groupIds = new Map<string, number>();
    for (const name of groupNames) {
      const [row] = await db.insert(groups).values({ name }).returning({ id: groups.id });
      groupIds.set(name, row.id);
    }

    for (const { name, frequency, createdAt, noteAt, group } of people) {
      const [row] = await db
        .insert(contacts)
        .values({ name, contactFrequency: frequency, createdAt })
        .returning({ id: contacts.id });
      if (noteAt) {
        await db.insert(notes).values({ contactId: row.id, body: "Заметка", createdAt: noteAt });
      }
      if (group) {
        await db.insert(contactGroups).values({ contactId: row.id, groupId: groupIds.get(group)! });
      }
    }
    return groupIds;
  } finally {
    await client.end();
  }
}
