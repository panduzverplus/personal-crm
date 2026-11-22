import "server-only";
import { and, count, desc, eq, inArray, isNotNull, max, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { contactGroups, contacts, groups, notes, type NewContact } from "@/db/schema";
import { birthdayFromColumns, birthdayWindow, isLeapYear, matchWindow } from "@/lib/birthday";
import type { ContactInput } from "@/lib/contact-form";
import { dueDate, isOverdue } from "@/lib/keep-in-touch";

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
  return and(...words.map((word) => sql`${normalizedName} like ${`%${escapeLikePattern(word)}%`}`));
}

// Drizzle drops the table name from columns in a single-table query, so inside a subquery
// `${contacts.id}` would read as a bare "id" and could mean the subquery's own table.
// The outer contact is therefore written out in full.
const outerContactId = sql.raw('"contacts"."id"');

/** The contact is in the group, and the group is the user's own: a group id of another user matches nothing. */
function isInGroup(userId: string, groupId: number): SQL {
  return sql`exists (
    select 1 from contact_groups cg
    join groups g on g.id = cg.group_id
    where cg.contact_id = ${outerContactId}
      and cg.group_id = ${groupId}
      and g.owner_id = ${userId}
  )`;
}

/**
 * Contacts of the user whose name matches the query, only from the group when one is given.
 * `total` counts all contacts of the user, `groupTotal` those in the group (all of them without a group).
 */
export async function searchContacts(userId: string, query: string, groupId: number | null) {
  // Contacts must always be read fresh from the database, never prerendered.
  await connection();

  const [items, [{ total }], groupTotal] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        about: contacts.about,
        phone: contacts.phone,
        email: contacts.email,
        // Names of the contact's groups in one subquery, so rows do not cost extra queries.
        groups: sql<string[]>`coalesce((
          select array_agg(g.name order by g.name collate "ru-x-icu", g.id)
          from contact_groups cg
          join groups g on g.id = cg.group_id
          where cg.contact_id = ${outerContactId}
            and g.owner_id = ${userId}
        ), '{}')`,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.ownerId, userId),
          nameMatchesQuery(query),
          groupId === null ? undefined : isInGroup(userId, groupId),
        ),
      )
      .orderBy(sql`${contacts.name} collate "ru-x-icu"`, contacts.id),
    db.select({ total: count() }).from(contacts).where(eq(contacts.ownerId, userId)),
    groupId === null
      ? undefined
      : db
          .select({ total: count() })
          .from(contacts)
          .where(and(eq(contacts.ownerId, userId), isInGroup(userId, groupId))),
  ]);

  return { items, total, groupTotal: groupTotal ? groupTotal[0].total : total };
}

export type ContactListItem = Awaited<ReturnType<typeof searchContacts>>["items"][number];

/**
 * Contacts of the user with a frequency whose due day has passed: the most overdue first,
 * the same due day by name. The due day counts from the latest note, or from
 * when the contact was added if it has no notes. With a group, only its contacts.
 */
export async function getOverdueContacts(userId: string, groupId: number | null) {
  await connection();

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: contacts.contactFrequency,
      createdAt: contacts.createdAt,
      // Only the creation time counts: editing an old note does not reset the due day.
      lastNoteAt: max(notes.createdAt),
    })
    .from(contacts)
    .leftJoin(notes, eq(notes.contactId, contacts.id))
    .where(
      and(
        eq(contacts.ownerId, userId),
        isNotNull(contacts.contactFrequency),
        groupId === null ? undefined : isInGroup(userId, groupId),
      ),
    )
    .groupBy(contacts.id);

  const today = new Date();
  return rows
    .flatMap(({ frequency, createdAt, ...contact }) => {
      if (!frequency) return [];
      const due = dueDate(contact.lastNoteAt ?? createdAt, frequency);
      return isOverdue(due, today) ? [{ ...contact, frequency, due }] : [];
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.name.localeCompare(b.name, "ru"));
}

export type OverdueContact = Awaited<ReturnType<typeof getOverdueContacts>>[number];

/**
 * Contacts of the user whose birthday is today or in the next 7 days: the nearest first,
 * the same day by name. With a group, only its contacts. `today` is a parameter for tests.
 */
export async function getUpcomingBirthdays(
  userId: string,
  groupId: number | null,
  today: Date = new Date(),
) {
  await connection();

  const window = birthdayWindow(today);
  // The database only narrows by day and month; the window then works out the day and the age.
  const days = window.map(({ month, day }) => [month, day]);
  // No February 29 in this year: such a birthday is on February 28, so look for it too.
  if (
    window.some(
      ({ date, month, day }) => month === 2 && day === 28 && !isLeapYear(date.getFullYear()),
    )
  ) {
    days.push([2, 29]);
  }

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      birthDay: contacts.birthDay,
      birthMonth: contacts.birthMonth,
      birthYear: contacts.birthYear,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.ownerId, userId),
        or(
          ...days.map(([month, day]) =>
            and(eq(contacts.birthMonth, month), eq(contacts.birthDay, day)),
          ),
        ),
        groupId === null ? undefined : isInGroup(userId, groupId),
      ),
    );

  return rows
    .flatMap(({ id, name, ...columns }) => {
      const birthday = birthdayFromColumns(columns);
      const match = birthday && matchWindow(birthday, window);
      return match ? [{ id, name, ...match }] : [];
    })
    .sort((a, b) => a.daysAhead - b.daysAhead || a.name.localeCompare(b.name, "ru"));
}

export type UpcomingBirthday = Awaited<ReturnType<typeof getUpcomingBirthdays>>[number];

/** Turns the `[id]` URL segment into a contact id, or null if it is not a valid id. */
export function parseContactId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The user's own contact; a contact of another user is answered as a missing one (null). */
export async function getContact(userId: string, id: number) {
  await connection();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.ownerId, userId)))
    .limit(1);
  return contact ?? null;
}

/** Groups of one contact of the user, in alphabetical order. */
export async function getContactGroups(userId: string, contactId: number) {
  await connection();

  return db
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .innerJoin(contacts, eq(contacts.id, contactGroups.contactId))
    .where(
      and(
        eq(contactGroups.contactId, contactId),
        eq(contacts.ownerId, userId),
        eq(groups.ownerId, userId),
      ),
    )
    .orderBy(sql`${groups.name} collate "ru-x-icu"`, groups.id);
}

export async function getContactWithNotes(userId: string, id: number) {
  const contact = await getContact(userId, id);
  if (!contact) {
    return null;
  }

  const [contactNotes, contactGroupList] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(eq(notes.contactId, id))
      .orderBy(desc(notes.createdAt), desc(notes.id)),
    getContactGroups(userId, id),
  ]);

  return { contact, notes: contactNotes, groups: contactGroupList };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Makes `groupIds` the whole set of the contact's groups. A group that no longer exists
 * (deleted in another tab) or belongs to another user is skipped, so one stale checkbox
 * does not lose the other changes, and the result does not tell that such a group exists.
 * The caller has already checked that the contact is the user's own.
 */
async function replaceContactGroups(
  tx: Transaction,
  userId: string,
  contactId: number,
  groupIds: number[],
) {
  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));
  if (groupIds.length === 0) {
    return;
  }
  await tx.execute(
    sql`insert into ${contactGroups} (contact_id, group_id)
      select ${contactId}::int, ${groups.id} from ${groups}
      where ${inArray(groups.id, groupIds)} and ${groups.ownerId} = ${userId}`,
  );
}

/** Saves the user's contact together with its groups in one transaction; returns the new id. */
export async function insertContact(
  userId: string,
  values: Omit<NewContact, "ownerId">,
  groupIds: number[],
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contacts)
      .values({ ...values, ownerId: userId })
      .returning({ id: contacts.id });
    await replaceContactGroups(tx, userId, row.id, groupIds);
    return row.id;
  });
}

/**
 * Saves the contact and replaces its groups in one transaction.
 * Returns false when the user has no such contact (it does not exist or is someone else's).
 */
export async function updateContactById(
  userId: string,
  id: number,
  values: ContactInput,
  groupIds: number[],
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(contacts)
      .set(values)
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, userId)))
      .returning({ id: contacts.id });
    if (rows.length === 0) {
      return false;
    }
    await replaceContactGroups(tx, userId, id, groupIds);
    return true;
  });
}

/** Deletes the contact with all its notes; returns its name, or null when the user has no such contact. */
export async function deleteContactById(userId: string, id: number) {
  const [row] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.ownerId, userId)))
    .returning({ name: contacts.name });
  return row?.name ?? null;
}

/** Returns false when the user has no such contact. */
export async function insertNote(userId: string, contactId: number, body: string) {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, userId)))
    .limit(1);
  if (!contact) {
    return false;
  }

  await db.insert(notes).values({ contactId, body });
  return true;
}

/**
 * Saves new note text and stamps the edit time; an unchanged text keeps the old stamp.
 * Returns the note's contact id, or null when the user has no such note (a note belongs
 * to the owner of its contact).
 */
export async function updateNoteBody(userId: string, noteId: number, body: string) {
  const [note] = await db
    .select({ contactId: notes.contactId, body: notes.body })
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(and(eq(notes.id, noteId), eq(contacts.ownerId, userId)))
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
