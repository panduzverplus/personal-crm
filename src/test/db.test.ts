import { beforeEach, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
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
    await db.insert(contacts).values({ name: "Анна" });
    await resetDatabase();

    const [row] = await db
      .insert(contacts)
      .values({ name: "Борис" })
      .returning({ id: contacts.id });
    expect(row.id).toBe(1);
  });
});
