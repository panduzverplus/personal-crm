import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { contactGroups, contacts, groups, notes, users, type NewContact } from "@/db/schema";

// Helpers that put rows into the test database.

/** A user, like the one Better Auth creates at the first login. Returns the user id. */
export async function addUser(email: string) {
  const [row] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "", email, emailVerified: true })
    .returning({ id: users.id });
  return row.id;
}

export async function addContact(
  ownerId: string,
  name: string,
  values: Partial<Omit<NewContact, "name" | "ownerId">> = {},
) {
  const [row] = await db
    .insert(contacts)
    .values({ ownerId, name, ...values })
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

export async function addGroup(ownerId: string, name: string) {
  const [row] = await db.insert(groups).values({ ownerId, name }).returning({ id: groups.id });
  return row.id;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}
