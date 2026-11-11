import { beforeEach, describe, expect, it } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactGroups, contacts } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { countQueries } from "@/test/count-queries";
import { addContact, addGroup, addNote, addToGroup, addUser } from "@/test/factories";
import {
  deleteContactById,
  getContactGroups,
  getContactWithNotes,
  getOverdueContacts,
  insertContact,
  insertNote,
  searchContacts,
  updateContactById,
  updateNoteBody,
} from "./contacts";

// The user whose contacts these tests work with. Other users are in contacts-isolation.test.ts.
let user: string;

async function setUp() {
  await resetDatabase();
  user = await addUser("anna@example.com");
}

async function groupIdsOf(contactId: number) {
  const rows = await db
    .select({ groupId: contactGroups.groupId })
    .from(contactGroups)
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(asc(contactGroups.groupId));
  return rows.map((row) => row.groupId);
}

const noFields = {
  about: null,
  email: null,
  phone: null,
  howWeMet: null,
  contactFrequency: null,
};

describe("insertContact", () => {
  beforeEach(setUp);

  it("saves the contact in several groups", async () => {
    const family = await addGroup(user, "Семья");
    const tennis = await addGroup(user, "Теннис");

    const id = await insertContact(user, { name: "Анна" }, [family, tennis]);

    expect(await groupIdsOf(id)).toEqual([family, tennis]);
  });

  it("saves the contact without groups", async () => {
    await addGroup(user, "Семья");

    const id = await insertContact(user, { name: "Анна" }, []);

    expect(await groupIdsOf(id)).toEqual([]);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });

  it("skips a group that no longer exists and keeps the others", async () => {
    const family = await addGroup(user, "Семья");

    const id = await insertContact(user, { name: "Анна" }, [family, 12345]);

    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("does not leave a contact behind when saving the groups fails", async () => {
    const family = await addGroup(user, "Семья");
    // Makes the group link insert fail after the contact row is already inserted.
    await db.execute(
      sql`alter table contact_groups add constraint contact_groups_fail check (group_id < 0)`,
    );
    try {
      await expect(insertContact(user, { name: "Анна" }, [family])).rejects.toThrow();
    } finally {
      await db.execute(sql`alter table contact_groups drop constraint contact_groups_fail`);
    }

    expect(await db.select().from(contacts)).toEqual([]);
  });
});

describe("updateContactById", () => {
  beforeEach(setUp);

  it("replaces the set of groups", async () => {
    const family = await addGroup(user, "Семья");
    const tennis = await addGroup(user, "Теннис");
    const friends = await addGroup(user, "Друзья");
    const id = await insertContact(user, { name: "Анна" }, [family, tennis]);

    const updated = await updateContactById(user, id, { name: "Анна", ...noFields }, [
      friends,
      tennis,
    ]);

    expect(updated).toBe(true);
    expect(await groupIdsOf(id)).toEqual([tennis, friends]);
  });

  it("removes every group when none is passed", async () => {
    const family = await addGroup(user, "Семья");
    const id = await insertContact(user, { name: "Анна" }, [family]);

    await updateContactById(user, id, { name: "Анна", ...noFields }, []);

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("changes the contact fields together with the groups", async () => {
    const family = await addGroup(user, "Семья");
    const id = await insertContact(user, { name: "Анна" }, []);

    await updateContactById(user, id, { name: "Анна Петрова", ...noFields }, [family]);

    const [row] = await db.select().from(contacts);
    expect(row.name).toBe("Анна Петрова");
    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("skips a group that no longer exists and keeps the other changes", async () => {
    const family = await addGroup(user, "Семья");
    const id = await insertContact(user, { name: "Анна" }, []);

    await updateContactById(user, id, { name: "Анна Петрова", ...noFields }, [family, 12345]);

    const [row] = await db.select().from(contacts);
    expect(row.name).toBe("Анна Петрова");
    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("does not touch other contacts' groups", async () => {
    const family = await addGroup(user, "Семья");
    const tennis = await addGroup(user, "Теннис");
    const anna = await insertContact(user, { name: "Анна" }, [family]);
    const boris = await insertContact(user, { name: "Борис" }, [family]);

    await updateContactById(user, anna, { name: "Анна", ...noFields }, [tennis]);

    expect(await groupIdsOf(boris)).toEqual([family]);
  });

  it("returns false and changes nothing when the contact does not exist", async () => {
    const family = await addGroup(user, "Семья");
    await addContact(user, "Борис");

    const updated = await updateContactById(user, 12345, { name: "Анна", ...noFields }, [family]);

    expect(updated).toBe(false);
    expect(await db.select().from(contactGroups)).toEqual([]);
  });
});

describe("searchContacts", () => {
  beforeEach(setUp);

  it("returns contacts by name with their groups in alphabetical order", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const friends = await addGroup(user, "Друзья");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);
    await addToGroup(anna, friends);

    const { items } = await searchContacts(user, "", null);

    expect(items).toHaveLength(1);
    expect(items[0].groups).toEqual(["Друзья", "Семья", "Теннис"]);
  });

  it("returns an empty list of groups for a contact without groups", async () => {
    await addContact(user, "Анна");

    const { items } = await searchContacts(user, "", null);

    expect(items[0].groups).toEqual([]);
  });

  it("without a group returns every contact", async () => {
    const tennis = await addGroup(user, "Теннис");
    const anna = await addContact(user, "Анна");
    await addContact(user, "Борис");
    await addToGroup(anna, tennis);

    const { items, total, groupTotal } = await searchContacts(user, "", null);

    expect(items.map((item) => item.name)).toEqual(["Анна", "Борис"]);
    expect(total).toBe(2);
    expect(groupTotal).toBe(2);
  });

  it("with a group returns only its contacts", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addContact(user, "Анна");
    const boris = await addContact(user, "Борис");
    await addContact(user, "Вера");
    await addToGroup(anna, tennis);
    await addToGroup(boris, family);

    const { items } = await searchContacts(user, "", tennis);

    expect(items.map((item) => item.name)).toEqual(["Анна"]);
  });

  it("shows a contact of two groups under both of them", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const inTennis = await searchContacts(user, "", tennis);
    const inFamily = await searchContacts(user, "", family);

    expect(inTennis.items.map((item) => item.name)).toEqual(["Анна"]);
    expect(inFamily.items.map((item) => item.name)).toEqual(["Анна"]);
    // Both groups of the contact are shown whichever one is selected.
    expect(inTennis.items[0].groups).toEqual(["Семья", "Теннис"]);
  });

  it("searches by name only inside the group", async () => {
    const tennis = await addGroup(user, "Теннис");
    const anna = await addContact(user, "Анна Петрова");
    await addContact(user, "Анна Сидорова");
    const boris = await addContact(user, "Борис");
    await addToGroup(anna, tennis);
    await addToGroup(boris, tennis);

    const { items, groupTotal, total } = await searchContacts(user, "анна", tennis);

    expect(items.map((item) => item.name)).toEqual(["Анна Петрова"]);
    expect(groupTotal).toBe(2);
    expect(total).toBe(3);
  });

  it("returns nobody for a group without contacts and still counts all contacts", async () => {
    const empty = await addGroup(user, "Аналитики");
    await addContact(user, "Анна");

    const { items, total, groupTotal } = await searchContacts(user, "", empty);

    expect(items).toEqual([]);
    expect(groupTotal).toBe(0);
    expect(total).toBe(1);
  });

  it("returns nobody for a group that does not exist", async () => {
    await addContact(user, "Анна");

    const { items, groupTotal } = await searchContacts(user, "", 12345);

    expect(items).toEqual([]);
    expect(groupTotal).toBe(0);
  });

  it("sends the same number of queries whatever the number of contacts", async () => {
    const tennis = await addGroup(user, "Теннис");
    const first = await addContact(user, "Анна");
    await addToGroup(first, tennis);
    const queriesForOne = await countQueries(() => searchContacts(user, "", tennis));

    const more = await db
      .insert(contacts)
      .values(Array.from({ length: 30 }, (_, i) => ({ ownerId: user, name: `Контакт ${i}` })))
      .returning({ id: contacts.id });
    await db
      .insert(contactGroups)
      .values(more.map(({ id }) => ({ contactId: id, groupId: tennis })));
    const queriesForMany = await countQueries(() => searchContacts(user, "", tennis));

    expect(queriesForOne).toBeGreaterThan(0);
    expect(queriesForMany).toBe(queriesForOne);
  });
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

/** A contact with a weekly frequency added `days` days ago: overdue for any `days` over 8. */
const addWeekly = (name: string, days: number) =>
  addContact(user, name, { contactFrequency: "week", createdAt: daysAgo(days) });

describe("getOverdueContacts", () => {
  beforeEach(setUp);

  it("without a group returns every overdue contact, the most overdue first", async () => {
    await addWeekly("Вера", 20);
    await addWeekly("Анна", 40);
    await addWeekly("Борис", 30);
    // Not overdue yet, and no frequency at all.
    await addWeekly("Глеб", 2);
    await addContact(user, "Дарья");

    const overdue = await getOverdueContacts(user, null);

    expect(overdue.map((contact) => contact.name)).toEqual(["Анна", "Борис", "Вера"]);
  });

  it("with a group returns only overdue contacts from it", async () => {
    const tennis = await addGroup(user, "Теннис");
    const anna = await addWeekly("Анна", 40);
    const boris = await addWeekly("Борис", 30);
    await addWeekly("Вера", 20);
    const gleb = await addWeekly("Глеб", 2);
    await addToGroup(anna, tennis);
    await addToGroup(gleb, tennis);
    await addToGroup(boris, await addGroup(user, "Семья"));

    const overdue = await getOverdueContacts(user, tennis);

    expect(overdue.map((contact) => contact.name)).toEqual(["Анна"]);
  });

  it("keeps the order inside a group: most overdue first, then by name", async () => {
    const tennis = await addGroup(user, "Теннис");
    const createdAt = daysAgo(30);
    for (const name of ["Яна", "Борис", "Анна"]) {
      const id = await addContact(user, name, {
        contactFrequency: "week",
        createdAt,
      });
      await addToGroup(id, tennis);
    }
    const first = await addWeekly("Вера", 60);
    await addToGroup(first, tennis);

    const overdue = await getOverdueContacts(user, tennis);

    expect(overdue.map((contact) => contact.name)).toEqual(["Вера", "Анна", "Борис", "Яна"]);
  });

  it("returns a contact of several groups once for each of them", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addWeekly("Анна", 40);
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    expect(await getOverdueContacts(user, tennis)).toHaveLength(1);
    expect(await getOverdueContacts(user, family)).toHaveLength(1);
    expect(await getOverdueContacts(user, null)).toHaveLength(1);
  });

  it("returns nobody when no one in the group is overdue", async () => {
    const tennis = await addGroup(user, "Теннис");
    await addWeekly("Анна", 40);

    expect(await getOverdueContacts(user, tennis)).toEqual([]);
  });

  it("returns nobody for a group that does not exist", async () => {
    await addWeekly("Анна", 40);

    expect(await getOverdueContacts(user, 12345)).toEqual([]);
  });
});

describe("contact frequency and the due date", () => {
  beforeEach(setUp);

  const overdueNames = async () => (await getOverdueContacts(user, null)).map(({ name }) => name);

  it("saves the frequency chosen when adding a contact", async () => {
    await insertContact(user, { name: "Анна", contactFrequency: "month" }, []);

    const [row] = await db.select().from(contacts);
    expect(row.contactFrequency).toBe("month");
  });

  it("saves a contact without a frequency by default", async () => {
    await insertContact(user, { name: "Анна" }, []);

    const [row] = await db.select().from(contacts);
    expect(row.contactFrequency).toBeNull();
  });

  it("recounts the due date after the frequency changes", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(10),
    });
    expect(await overdueNames()).toEqual([]);

    await updateContactById(user, id, { name: "Анна", ...noFields, contactFrequency: "week" }, []);

    const [row] = await db.select().from(contacts);
    expect(row.contactFrequency).toBe("week");
    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("drops a contact from the overdue list when the frequency is removed", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(60),
    });
    expect(await overdueNames()).toEqual(["Анна"]);

    await updateContactById(user, id, { name: "Анна", ...noFields }, []);

    expect(await overdueNames()).toEqual([]);
  });

  it("makes a long-known contact overdue as soon as a frequency is set", async () => {
    const id = await addContact(user, "Анна", { createdAt: daysAgo(180) });
    expect(await overdueNames()).toEqual([]);

    await updateContactById(user, id, { name: "Анна", ...noFields, contactFrequency: "month" }, []);

    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("restarts the due date from a new note", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(120),
    });
    await addNote(id, daysAgo(60));
    expect(await overdueNames()).toEqual(["Анна"]);

    await insertNote(user, id, "Созвонились");

    expect(await overdueNames()).toEqual([]);
  });

  it("counts from the latest note, not the first one", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(120),
    });
    await addNote(id, daysAgo(90));
    await addNote(id, daysAgo(5));

    expect(await overdueNames()).toEqual([]);
  });

  it("does not restart the due date when an old note is edited", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(120),
    });
    const noteId = await addNote(id, daysAgo(60));

    await updateNoteBody(user, noteId, "Исправленный текст");

    expect(await overdueNames()).toEqual(["Анна"]);
  });

  it("returns the date of the latest note for the row of the block", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(120),
    });
    await addNote(id, daysAgo(90));
    const latest = daysAgo(60);
    await addNote(id, latest);

    const [contact] = await getOverdueContacts(user, null);

    expect(contact.lastNoteAt).toEqual(latest);
  });

  it("drops a deleted contact from the overdue list", async () => {
    const id = await addContact(user, "Анна", {
      contactFrequency: "month",
      createdAt: daysAgo(60),
    });
    await addContact(user, "Борис", { contactFrequency: "month", createdAt: daysAgo(60) });

    await deleteContactById(user, id);

    expect(await overdueNames()).toEqual(["Борис"]);
  });
});

describe("contact groups", () => {
  beforeEach(setUp);

  it("getContactGroups returns the groups of the contact by name", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    await addGroup(user, "Друзья");
    const anna = await addContact(user, "Анна");
    const boris = await addContact(user, "Борис");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);
    await addToGroup(boris, tennis);

    expect(await getContactGroups(user, anna)).toEqual([
      { id: family, name: "Семья" },
      { id: tennis, name: "Теннис" },
    ]);
  });

  it("getContactGroups returns an empty list for a contact without groups", async () => {
    const anna = await addContact(user, "Анна");

    expect(await getContactGroups(user, anna)).toEqual([]);
  });

  it("getContactWithNotes includes the groups of the contact", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const data = await getContactWithNotes(user, anna);

    expect(data?.groups.map((group) => group.name)).toEqual(["Семья", "Теннис"]);
  });

  it("getContactWithNotes returns no groups for a contact without them", async () => {
    const anna = await addContact(user, "Анна");

    expect((await getContactWithNotes(user, anna))?.groups).toEqual([]);
  });

  it("getContactWithNotes returns null for a contact that does not exist", async () => {
    expect(await getContactWithNotes(user, 12345)).toBeNull();
  });
});
