import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactGroups, contacts, notes } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addGroup, addNote, addToGroup, addUser } from "@/test/factories";
import {
  deleteContactById,
  getContact,
  getContactGroups,
  getContactWithNotes,
  getOverdueContacts,
  getUpcomingBirthdays,
  insertContact,
  insertNote,
  searchContacts,
  updateContactById,
  updateNoteBody,
} from "./contacts";

// Two users, A and B. Everything that belongs to A is asked for as B: B must get the answer
// that he would get for a record that does not exist, and A's data must not change.

const DAY = 24 * 60 * 60 * 1000;
const noFields = {
  about: null,
  email: null,
  phone: null,
  howWeMet: null,
  contactFrequency: null,
  birthDay: null,
  birthMonth: null,
  birthYear: null,
};

let a: string;
let b: string;

// A's data: a contact "Анна Смирнова" in the group "Теннис" with a note, overdue for a month.
let annaId: number;
let tennisId: number;
let noteId: number;

beforeEach(async () => {
  await resetDatabase();
  a = await addUser("a@example.com");
  b = await addUser("b@example.com");
  tennisId = await addGroup(a, "Теннис");
  annaId = await addContact(a, "Анна Смирнова", {
    contactFrequency: "week",
    createdAt: new Date(Date.now() - 40 * DAY),
  });
  await addToGroup(annaId, tennisId);
  noteId = await addNote(annaId, new Date(Date.now() - 30 * DAY), "Заметка Анны");
});

async function annaRow() {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, annaId));
  return row;
}

describe("a contact belongs to the user who created it", () => {
  it("is saved with the owner and is not visible to another user", async () => {
    const id = await insertContact(b, { name: "Борис" }, []);

    const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
    expect(row.ownerId).toBe(b);
    expect((await searchContacts(a, "", null)).items.map((item) => item.name)).toEqual([
      "Анна Смирнова",
    ]);
    expect(await getContact(a, id)).toBeNull();
  });

  it("is saved without the group of another user", async () => {
    const id = await insertContact(b, { name: "Борис" }, [tennisId]);

    expect(await getContactGroups(b, id)).toEqual([]);
    expect(await db.select().from(contactGroups)).toEqual([
      { contactId: annaId, groupId: tennisId },
    ]);
  });

  it("is saved with own groups and skips the groups of another user among them", async () => {
    const friends = await addGroup(b, "Друзья");

    const id = await insertContact(b, { name: "Борис" }, [tennisId, friends]);

    expect((await getContactGroups(b, id)).map((group) => group.name)).toEqual(["Друзья"]);
  });

  it("gets a note only for an own contact", async () => {
    expect(await insertNote(b, annaId, "Чужая заметка")).toBe(false);
    expect(await db.select().from(notes)).toHaveLength(1);

    expect(await insertNote(a, annaId, "Своя заметка")).toBe(true);
    expect(await db.select().from(notes)).toHaveLength(2);
  });
});

describe("a user sees only own contacts", () => {
  it("does not list contacts of another user or count them", async () => {
    await addContact(b, "Борис");

    const result = await searchContacts(b, "", null);

    expect(result.items.map((item) => item.name)).toEqual(["Борис"]);
    expect(result.total).toBe(1);
    expect(result.groupTotal).toBe(1);
  });

  it("does not find a contact of another user by name", async () => {
    await addContact(b, "Борис");

    const result = await searchContacts(b, "Анна", null);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(1);
  });

  it("shows nothing for the group of another user", async () => {
    await addContact(b, "Борис");

    const result = await searchContacts(b, "", tennisId);

    expect(result.items).toEqual([]);
    expect(result.groupTotal).toBe(0);
    expect(result.total).toBe(1);
  });

  it("does not show the name of a group of another user in a row", async () => {
    const boris = await addContact(b, "Борис");
    const own = await addGroup(b, "Друзья");
    await addToGroup(boris, own);
    // A link that the app never makes, but the list must not rely on that.
    await addToGroup(boris, tennisId);

    const { items } = await searchContacts(b, "", null);

    expect(items[0].groups).toEqual(["Друзья"]);
  });

  it("does not return overdue contacts of another user", async () => {
    expect((await getOverdueContacts(a, null)).map((contact) => contact.name)).toEqual([
      "Анна Смирнова",
    ]);

    expect(await getOverdueContacts(b, null)).toEqual([]);
    expect(await getOverdueContacts(b, tennisId)).toEqual([]);
  });

  it("does not return soon birthdays of another user", async () => {
    const today = new Date(2026, 10, 22);
    await db.update(contacts).set({ birthDay: 23, birthMonth: 11 }).where(eq(contacts.id, annaId));

    expect((await getUpcomingBirthdays(a, null, today)).map((contact) => contact.name)).toEqual([
      "Анна Смирнова",
    ]);

    expect(await getUpcomingBirthdays(b, null, today)).toEqual([]);
    expect(await getUpcomingBirthdays(b, tennisId, today)).toEqual([]);
  });

  it("does not open a contact of another user", async () => {
    expect(await getContact(b, annaId)).toBeNull();
    expect(await getContactWithNotes(b, annaId)).toBeNull();
    expect(await getContactGroups(b, annaId)).toEqual([]);

    expect((await getContactWithNotes(a, annaId))?.notes).toHaveLength(1);
  });
});

describe("a request with an id of another user changes nothing", () => {
  it("updateContactById answers as for a missing contact", async () => {
    const before = await annaRow();

    const updated = await updateContactById(b, annaId, { name: "Взломано", ...noFields }, []);

    expect(updated).toBe(false);
    expect(await annaRow()).toEqual(before);
    expect(await db.select().from(contactGroups)).toEqual([
      { contactId: annaId, groupId: tennisId },
    ]);
  });

  it("updateContactById does not change the birthday of another user's contact", async () => {
    const before = await annaRow();

    const updated = await updateContactById(
      b,
      annaId,
      { name: "Анна", ...noFields, birthDay: 1, birthMonth: 1, birthYear: 2000 },
      [],
    );

    expect(updated).toBe(false);
    expect(await annaRow()).toEqual(before);
  });

  it("deleteContactById answers as for a missing contact", async () => {
    expect(await deleteContactById(b, annaId)).toBeNull();

    expect(await annaRow()).toBeDefined();
    expect(await db.select().from(notes)).toHaveLength(1);
  });

  it("updateNoteBody answers as for a missing note", async () => {
    expect(await updateNoteBody(b, noteId, "Взломано")).toBeNull();

    const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
    expect(note.body).toBe("Заметка Анны");
    expect(note.updatedAt).toBeNull();
  });

  it("updateNoteBody still edits an own note", async () => {
    expect(await updateNoteBody(a, noteId, "Новый текст")).toBe(annaId);
  });
});

describe("a new user starts with nothing", () => {
  it("has an empty list, no overdue contacts and no contacts in any group", async () => {
    const newcomer = await addUser("new@example.com");

    const result = await searchContacts(newcomer, "", null);

    expect(result).toEqual({ items: [], total: 0, groupTotal: 0 });
    expect(await getOverdueContacts(newcomer, null)).toEqual([]);
    expect(await getUpcomingBirthdays(newcomer, null)).toEqual([]);
  });
});
