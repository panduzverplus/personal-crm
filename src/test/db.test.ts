import { beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { addContact, addUser } from "./factories";
import { assertTestDatabase, resetDatabase } from "./db";

describe("test database", () => {
  beforeEach(resetDatabase);

  it("connects to a database whose name ends with _test", async () => {
    await expect(assertTestDatabase()).resolves.toBeUndefined();
  });

  it("reads the contacts table", async () => {
    const [{ total }] = await db.select({ total: count() }).from(contacts);
    expect(total).toBe(0);
  });

  it("empties the tables and restarts ids", async () => {
    const user = await addUser("anna@example.com");
    await addContact(user, "Анна");
    await resetDatabase();

    const second = await addUser("anna@example.com");
    const id = await addContact(second, "Борис");
    expect(id).toBe(1);
  });
});
