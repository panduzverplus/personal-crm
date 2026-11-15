import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addGroup, addUser } from "@/test/factories";

// Drizzle wraps the driver error: the Postgres error code is on `cause`.
const uniqueViolation = { cause: { code: "23505" } };

let user: string;

describe("groups schema", () => {
  beforeEach(async () => {
    await resetDatabase();
    user = await addUser("anna@example.com");
  });

  it("deleting a contact removes only its group links", async () => {
    const anna = await addContact(user, "Анна");
    const boris = await addContact(user, "Борис");
    const tennis = await addGroup(user, "Теннис");
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
    const anna = await addContact(user, "Анна");
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    await db.insert(contactGroups).values([
      { contactId: anna, groupId: tennis },
      { contactId: anna, groupId: family },
    ]);

    await db.delete(groups).where(eq(groups.id, tennis));

    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(contactGroups)).toEqual([{ contactId: anna, groupId: family }]);
  });

  it("does not store a second group differing only by letter case", async () => {
    await addGroup(user, "Теннис");

    await expect(addGroup(user, "теннис")).rejects.toMatchObject(uniqueViolation);
    expect(await db.select().from(groups)).toHaveLength(1);
  });

  it("does not store a second group differing only by е and ё", async () => {
    await addGroup(user, "Алёна");

    await expect(addGroup(user, "Алена")).rejects.toMatchObject(uniqueViolation);
    expect(await db.select().from(groups)).toHaveLength(1);
  });

  it("stores groups with the same name for different users", async () => {
    const boris = await addUser("boris@example.com");
    await addGroup(user, "Друзья");

    await expect(addGroup(boris, "друзья")).resolves.toEqual(expect.any(Number));
    expect(await db.select().from(groups)).toHaveLength(2);
  });

  it("does not link a contact to the same group twice", async () => {
    const anna = await addContact(user, "Анна");
    const tennis = await addGroup(user, "Теннис");
    await db.insert(contactGroups).values({ contactId: anna, groupId: tennis });

    await expect(
      db.insert(contactGroups).values({ contactId: anna, groupId: tennis }),
    ).rejects.toMatchObject(uniqueViolation);
  });

  it("does not store a contact or a group without an owner", async () => {
    // Postgres code 23502 is not_null_violation.
    await expect(
      db.execute(sql`insert into contacts (name) values ('Анна')`),
    ).rejects.toMatchObject({ cause: { code: "23502" } });
    await expect(
      db.execute(sql`insert into groups (name) values ('Теннис')`),
    ).rejects.toMatchObject({ cause: { code: "23502" } });
  });
});
