import "server-only";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { contacts, notes, type NewContact } from "@/db/schema";
import type { ContactInput } from "@/lib/contact-form";

/** Lowercases and treats "ё" as "е", so "Алена" also finds "Алёна". */
function normalizeForSearch(value: string) {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Every word of the query must appear in the name, in any order. */
function nameMatchesQuery(query: string): SQL | undefined {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return undefined;
  }
  const normalizedName = sql`replace(lower(${contacts.name}), 'ё', 'е')`;
  return and(
    ...words.map(
      (word) => sql`${normalizedName} like ${`%${escapeLikePattern(word)}%`}`,
    ),
  );
}

export async function searchContacts(query: string) {
  // Contacts must always be read fresh from the database, never prerendered.
  await connection();

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        about: contacts.about,
        phone: contacts.phone,
        email: contacts.email,
      })
      .from(contacts)
      .where(nameMatchesQuery(query))
      .orderBy(sql`${contacts.name} collate "ru-x-icu"`, contacts.id),
    db.select({ total: count() }).from(contacts),
  ]);

  return { items, total };
}

export type ContactListItem = Awaited<
  ReturnType<typeof searchContacts>
>["items"][number];

/** Turns the `[id]` URL segment into a contact id, or null if it is not a valid id. */
export function parseContactId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getContact(id: number) {
  await connection();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  return contact ?? null;
}

export async function getContactWithNotes(id: number) {
  const contact = await getContact(id);
  if (!contact) {
    return null;
  }

  const contactNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.contactId, id))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  return { contact, notes: contactNotes };
}

export async function insertContact(values: NewContact) {
  const [row] = await db
    .insert(contacts)
    .values(values)
    .returning({ id: contacts.id });
  return row.id;
}

/** Returns false when the contact does not exist. */
export async function updateContactById(id: number, values: ContactInput) {
  const rows = await db
    .update(contacts)
    .set(values)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return rows.length > 0;
}

/** Deletes the contact with all its notes; returns its name, or null when it does not exist. */
export async function deleteContactById(id: number) {
  const [row] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ name: contacts.name });
  return row?.name ?? null;
}

/** Returns false when the contact does not exist. */
export async function insertNote(contactId: number, body: string) {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) {
    return false;
  }

  await db.insert(notes).values({ contactId, body });
  return true;
}

/**
 * Saves new note text and stamps the edit time; an unchanged text keeps the old stamp.
 * Returns the note's contact id, or null when the note does not exist.
 */
export async function updateNoteBody(noteId: number, body: string) {
  const [note] = await db
    .select({ contactId: notes.contactId, body: notes.body })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  if (!note) {
    return null;
  }

  if (note.body !== body) {
    await db
      .update(notes)
      .set({ body, updatedAt: sql`now()` })
      .where(eq(notes.id, noteId));
  }
  return note.contactId;
}
