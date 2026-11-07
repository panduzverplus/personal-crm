import { db } from "@/db";
import {
  contactGroups,
  contacts,
  groups,
  type NewContact,
} from "@/db/schema";

// Helpers that put rows into the test database.

export async function addContact(
  name: string,
  values: Partial<Omit<NewContact, "name">> = {},
) {
  const [row] = await db
    .insert(contacts)
    .values({ name, ...values })
    .returning({ id: contacts.id });
  return row.id;
}

export async function addGroup(name: string) {
  const [row] = await db
    .insert(groups)
    .values({ name })
    .returning({ id: groups.id });
  return row.id;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}
