import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { resetDatabase } from "@/test/db";

// Drizzle wraps the driver error: the Postgres error code is on `cause`.
const uniqueViolation = { cause: { code: "23505" } };

async function addContact(name: string) {
  const [row] = await db.insert(contacts).values({ name }).returning({ id: contacts.id });
  return row.id;
}

async function addGroup(name: string) {
  const [row] = await db.insert(groups).values({ name }).returning({ id: groups.id });
  return row.id;
}

describe("groups schema", () => {
  beforeEach(resetDatabase);

  it("deleting a contact removes only its group links", async () => {
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    const tennis = await addGroup("Теннис");
    await db.insert(contactGroups).values([
      { contactId: anna, groupId: tennis },
      { contactId: boris, groupId: tennis },
    ]);

    await db.delete(contacts).where(eq(contacts.id, anna));

    const links = await db.select().from(contactGroups);
    expect(links).toEqual([{ contactId: boris, groupId: tennis }]);
    expect(await db.select().from(groups)).toHaveLength(1);
  });

  it("deleting a group keeps its contacts and their other groups", async () => {
    const anna = await addContact("Анна");
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    await db.insert(contactGroups).values([
      { contactId: anna, groupId: tennis },
      { contactId: anna, groupId: family },
    ]);

    await db.delete(groups).where(eq(groups.id, tennis));

    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(contactGroups)).toEqual([{ contactId: anna, groupId: family }]);
  });

  it("does not store a second group differing only by letter case", async () => {
    await addGroup("Теннис");

    await expect(addGroup("теннис")).rejects.toMatchObject(uniqueViolation);
    expect(await db.select().from(groups)).toHaveLength(1);
  });

  it("does not store a second group differing only by е and ё", async () => {
    await addGroup("Алёна");

    await expect(addGroup("Алена")).rejects.toMatchObject(uniqueViolation);
    expect(await db.select().from(groups)).toHaveLength(1);
  });

  it("does not link a contact to the same group twice", async () => {
    const anna = await addContact("Анна");
    const tennis = await addGroup("Теннис");
    await db.insert(contactGroups).values({ contactId: anna, groupId: tennis });

    await expect(
      db.insert(contactGroups).values({ contactId: anna, groupId: tennis }),
    ).rejects.toMatchObject(uniqueViolation);
  });
});
