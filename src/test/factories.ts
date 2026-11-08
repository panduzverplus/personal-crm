import { db } from "@/db";
import { contactGroups, contacts, groups, notes, type NewContact } from "@/db/schema";

// Helpers that put rows into the test database.

export async function addContact(name: string, values: Partial<Omit<NewContact, "name">> = {}) {
  const [row] = await db
    .insert(contacts)
    .values({ name, ...values })
    .returning({ id: contacts.id });
  return row.id;
}

/** A note written at the given moment, for tests about older notes. */
export async function addNote(contactId: number, createdAt: Date, body = "Заметка") {
  const [row] = await db
    .insert(notes)
    .values({ contactId, body, createdAt })
    .returning({ id: notes.id });
  return row.id;
}

export async function addGroup(name: string) {
  const [row] = await db.insert(groups).values({ name }).returning({ id: groups.id });
  return row.id;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}
