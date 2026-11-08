import { beforeEach, describe, expect, it } from "vitest";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactGroups, contacts } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { countQueries } from "@/test/count-queries";
import { addContact, addGroup, addToGroup } from "@/test/factories";
import {
  getContactGroups,
  getContactWithNotes,
  getOverdueContacts,
  insertContact,
  searchContacts,
  updateContactById,
} from "./contacts";

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
  beforeEach(resetDatabase);

  it("saves the contact in several groups", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");

    const id = await insertContact({ name: "Анна" }, [family, tennis]);

    expect(await groupIdsOf(id)).toEqual([family, tennis]);
  });

  it("saves the contact without groups", async () => {
    await addGroup("Семья");

    const id = await insertContact({ name: "Анна" }, []);

    expect(await groupIdsOf(id)).toEqual([]);
    expect(await db.select().from(contacts)).toHaveLength(1);
  });

  it("skips a group that no longer exists and keeps the others", async () => {
    const family = await addGroup("Семья");

    const id = await insertContact({ name: "Анна" }, [family, 12345]);

    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("does not leave a contact behind when saving the groups fails", async () => {
    const family = await addGroup("Семья");
    // Makes the group link insert fail after the contact row is already inserted.
    await db.execute(
      sql`alter table contact_groups add constraint contact_groups_fail check (group_id < 0)`,
    );
    try {
      await expect(insertContact({ name: "Анна" }, [family])).rejects.toThrow();
    } finally {
      await db.execute(sql`alter table contact_groups drop constraint contact_groups_fail`);
    }

    expect(await db.select().from(contacts)).toEqual([]);
  });
});

describe("updateContactById", () => {
  beforeEach(resetDatabase);

  it("replaces the set of groups", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    const friends = await addGroup("Друзья");
    const id = await insertContact({ name: "Анна" }, [family, tennis]);

    const updated = await updateContactById(id, { name: "Анна", ...noFields }, [friends, tennis]);

    expect(updated).toBe(true);
    expect(await groupIdsOf(id)).toEqual([tennis, friends]);
  });

  it("removes every group when none is passed", async () => {
    const family = await addGroup("Семья");
    const id = await insertContact({ name: "Анна" }, [family]);

    await updateContactById(id, { name: "Анна", ...noFields }, []);

    expect(await groupIdsOf(id)).toEqual([]);
  });

  it("changes the contact fields together with the groups", async () => {
    const family = await addGroup("Семья");
    const id = await insertContact({ name: "Анна" }, []);

    await updateContactById(id, { name: "Анна Петрова", ...noFields }, [family]);

    const [row] = await db.select().from(contacts);
    expect(row.name).toBe("Анна Петрова");
    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("skips a group that no longer exists and keeps the other changes", async () => {
    const family = await addGroup("Семья");
    const id = await insertContact({ name: "Анна" }, []);

    await updateContactById(id, { name: "Анна Петрова", ...noFields }, [family, 12345]);

    const [row] = await db.select().from(contacts);
    expect(row.name).toBe("Анна Петрова");
    expect(await groupIdsOf(id)).toEqual([family]);
  });

  it("does not touch other contacts' groups", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    const anna = await insertContact({ name: "Анна" }, [family]);
    const boris = await insertContact({ name: "Борис" }, [family]);

    await updateContactById(anna, { name: "Анна", ...noFields }, [tennis]);

    expect(await groupIdsOf(boris)).toEqual([family]);
  });

  it("returns false and changes nothing when the contact does not exist", async () => {
    const family = await addGroup("Семья");
    await addContact("Борис");

    const updated = await updateContactById(12345, { name: "Анна", ...noFields }, [family]);

    expect(updated).toBe(false);
    expect(await db.select().from(contactGroups)).toEqual([]);
  });
});

describe("searchContacts", () => {
  beforeEach(resetDatabase);

  it("returns contacts by name with their groups in alphabetical order", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const friends = await addGroup("Друзья");
    const anna = await addContact("Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);
    await addToGroup(anna, friends);

    const { items } = await searchContacts("", null);

    expect(items).toHaveLength(1);
    expect(items[0].groups).toEqual(["Друзья", "Семья", "Теннис"]);
  });

  it("returns an empty list of groups for a contact without groups", async () => {
    await addContact("Анна");

    const { items } = await searchContacts("", null);

    expect(items[0].groups).toEqual([]);
  });

  it("without a group returns every contact", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await addContact("Борис");
    await addToGroup(anna, tennis);

    const { items, total, groupTotal } = await searchContacts("", null);

    expect(items.map((item) => item.name)).toEqual(["Анна", "Борис"]);
    expect(total).toBe(2);
    expect(groupTotal).toBe(2);
  });

  it("with a group returns only its contacts", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addContact("Вера");
    await addToGroup(anna, tennis);
    await addToGroup(boris, family);

    const { items } = await searchContacts("", tennis);

    expect(items.map((item) => item.name)).toEqual(["Анна"]);
  });

  it("shows a contact of two groups under both of them", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const inTennis = await searchContacts("", tennis);
    const inFamily = await searchContacts("", family);

    expect(inTennis.items.map((item) => item.name)).toEqual(["Анна"]);
    expect(inFamily.items.map((item) => item.name)).toEqual(["Анна"]);
    // Both groups of the contact are shown whichever one is selected.
    expect(inTennis.items[0].groups).toEqual(["Семья", "Теннис"]);
  });

  it("searches by name only inside the group", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна Петрова");
    await addContact("Анна Сидорова");
    const boris = await addContact("Борис");
    await addToGroup(anna, tennis);
    await addToGroup(boris, tennis);

    const { items, groupTotal, total } = await searchContacts("анна", tennis);

    expect(items.map((item) => item.name)).toEqual(["Анна Петрова"]);
    expect(groupTotal).toBe(2);
    expect(total).toBe(3);
  });

  it("returns nobody for a group without contacts and still counts all contacts", async () => {
    const empty = await addGroup("Аналитики");
    await addContact("Анна");

    const { items, total, groupTotal } = await searchContacts("", empty);

    expect(items).toEqual([]);
    expect(groupTotal).toBe(0);
    expect(total).toBe(1);
  });

  it("returns nobody for a group that does not exist", async () => {
    await addContact("Анна");

    const { items, groupTotal } = await searchContacts("", 12345);

    expect(items).toEqual([]);
    expect(groupTotal).toBe(0);
  });

  it("sends the same number of queries whatever the number of contacts", async () => {
    const tennis = await addGroup("Теннис");
    const first = await addContact("Анна");
    await addToGroup(first, tennis);
    const queriesForOne = await countQueries(() => searchContacts("", tennis));

    const more = await db
      .insert(contacts)
      .values(Array.from({ length: 30 }, (_, i) => ({ name: `Контакт ${i}` })))
      .returning({ id: contacts.id });
    await db
      .insert(contactGroups)
      .values(more.map(({ id }) => ({ contactId: id, groupId: tennis })));
    const queriesForMany = await countQueries(() => searchContacts("", tennis));

    expect(queriesForOne).toBeGreaterThan(0);
    expect(queriesForMany).toBe(queriesForOne);
  });
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

/** A contact with a weekly frequency added `days` days ago: overdue for any `days` over 8. */
const addWeekly = (name: string, days: number) =>
  addContact(name, { contactFrequency: "week", createdAt: daysAgo(days) });

describe("getOverdueContacts", () => {
  beforeEach(resetDatabase);

  it("without a group returns every overdue contact, the most overdue first", async () => {
    await addWeekly("Вера", 20);
    await addWeekly("Анна", 40);
    await addWeekly("Борис", 30);
    // Not overdue yet, and no frequency at all.
    await addWeekly("Глеб", 2);
    await addContact("Дарья");

    const overdue = await getOverdueContacts(null);

    expect(overdue.map((contact) => contact.name)).toEqual(["Анна", "Борис", "Вера"]);
  });

  it("with a group returns only overdue contacts from it", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addWeekly("Анна", 40);
    const boris = await addWeekly("Борис", 30);
    await addWeekly("Вера", 20);
    const gleb = await addWeekly("Глеб", 2);
    await addToGroup(anna, tennis);
    await addToGroup(gleb, tennis);
    await addToGroup(boris, await addGroup("Семья"));

    const overdue = await getOverdueContacts(tennis);

    expect(overdue.map((contact) => contact.name)).toEqual(["Анна"]);
  });

  it("keeps the order inside a group: most overdue first, then by name", async () => {
    const tennis = await addGroup("Теннис");
    const createdAt = daysAgo(30);
    for (const name of ["Яна", "Борис", "Анна"]) {
      const id = await addContact(name, {
        contactFrequency: "week",
        createdAt,
      });
      await addToGroup(id, tennis);
    }
    const first = await addWeekly("Вера", 60);
    await addToGroup(first, tennis);

    const overdue = await getOverdueContacts(tennis);

    expect(overdue.map((contact) => contact.name)).toEqual(["Вера", "Анна", "Борис", "Яна"]);
  });

  it("returns a contact of several groups once for each of them", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addWeekly("Анна", 40);
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    expect(await getOverdueContacts(tennis)).toHaveLength(1);
    expect(await getOverdueContacts(family)).toHaveLength(1);
    expect(await getOverdueContacts(null)).toHaveLength(1);
  });

  it("returns nobody when no one in the group is overdue", async () => {
    const tennis = await addGroup("Теннис");
    await addWeekly("Анна", 40);

    expect(await getOverdueContacts(tennis)).toEqual([]);
  });

  it("returns nobody for a group that does not exist", async () => {
    await addWeekly("Анна", 40);

    expect(await getOverdueContacts(12345)).toEqual([]);
  });
});

describe("contact groups", () => {
  beforeEach(resetDatabase);

  it("getContactGroups returns the groups of the contact by name", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    await addGroup("Друзья");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);
    await addToGroup(boris, tennis);

    expect(await getContactGroups(anna)).toEqual([
      { id: family, name: "Семья" },
      { id: tennis, name: "Теннис" },
    ]);
  });

  it("getContactGroups returns an empty list for a contact without groups", async () => {
    const anna = await addContact("Анна");

    expect(await getContactGroups(anna)).toEqual([]);
  });

  it("getContactWithNotes includes the groups of the contact", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const data = await getContactWithNotes(anna);

    expect(data?.groups.map((group) => group.name)).toEqual(["Семья", "Теннис"]);
  });

  it("getContactWithNotes returns no groups for a contact without them", async () => {
    const anna = await addContact("Анна");

    expect((await getContactWithNotes(anna))?.groups).toEqual([]);
  });

  it("getContactWithNotes returns null for a contact that does not exist", async () => {
    expect(await getContactWithNotes(12345)).toBeNull();
  });
});
