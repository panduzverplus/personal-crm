import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, notes, users } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addUser } from "@/test/factories";
import { createRandom } from "./seed-data";
import { seedDemoData } from "./seed-demo";

const options = { total: 30, random: createRandom(1), now: new Date(2026, 9, 12) };

async function contactCountOf(userId: string) {
  return (await db.select().from(contacts).where(eq(contacts.ownerId, userId))).length;
}

describe("seedDemoData", () => {
  beforeEach(resetDatabase);

  it("creates the owner when there is none and gives the contacts with notes to the owner", async () => {
    const result = await seedDemoData(db, "  Owner@Example.COM ", options);

    expect(result).toEqual({ status: "seeded", contacts: 30, notes: expect.any(Number) });
    const owners = await db.select().from(users);
    expect(owners).toHaveLength(1);
    expect(owners[0].email).toBe("owner@example.com");
    expect(await contactCountOf(owners[0].id)).toBe(30);
    expect(result.status === "seeded" && result.notes).toBeGreaterThan(0);
    expect(await db.select().from(notes)).toHaveLength(
      result.status === "seeded" ? result.notes : -1,
    );
  });

  it("uses the owner that already exists and does not create a second user", async () => {
    const owner = await addUser("owner@example.com");

    await seedDemoData(db, "owner@example.com", options);

    expect(await db.select().from(users)).toHaveLength(1);
    expect(await contactCountOf(owner)).toBe(30);
  });

  it("adds nothing when the owner already has contacts", async () => {
    const owner = await addUser("owner@example.com");
    await addContact(owner, "Анна");

    const result = await seedDemoData(db, "owner@example.com", options);

    expect(result).toEqual({ status: "skipped" });
    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(notes)).toEqual([]);
  });

  it("is not stopped by contacts of another user and does not touch them", async () => {
    const friend = await addUser("friend@example.com");
    const friendContact = await addContact(friend, "Борис");

    const result = await seedDemoData(db, "owner@example.com", options);

    expect(result.status).toBe("seeded");
    const [owner] = await db.select().from(users).where(eq(users.email, "owner@example.com"));
    expect(await contactCountOf(owner.id)).toBe(30);
    const friendRows = await db.select().from(contacts).where(eq(contacts.ownerId, friend));
    expect(friendRows.map((row) => row.id)).toEqual([friendContact]);
  });

  it("does not seed twice", async () => {
    await seedDemoData(db, "owner@example.com", options);

    const second = await seedDemoData(db, "owner@example.com", options);

    expect(second).toEqual({ status: "skipped" });
    expect(await db.select().from(contacts)).toHaveLength(30);
  });

  it.each([undefined, "", "   ", "owner@"])("refuses the owner email %j", async (email) => {
    await expect(seedDemoData(db, email, options)).rejects.toThrow(/OWNER_EMAIL/);

    expect(await db.select().from(users)).toEqual([]);
    expect(await db.select().from(contacts)).toEqual([]);
  });
});
