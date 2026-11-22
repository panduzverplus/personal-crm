import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addUser } from "@/test/factories";

// Drizzle wraps the driver error: the Postgres error code is on `cause`.
const checkViolation = { cause: { code: "23514" } };

let user: string;

async function birthdayOf(id: number) {
  const [row] = await db
    .select({
      day: contacts.birthDay,
      month: contacts.birthMonth,
      year: contacts.birthYear,
    })
    .from(contacts)
    .where(eq(contacts.id, id));
  return row;
}

describe("birthday columns", () => {
  beforeEach(async () => {
    await resetDatabase();
    user = await addUser("anna@example.com");
  });

  it("stores a contact without a birthday", async () => {
    const id = await addContact(user, "Анна");

    expect(await birthdayOf(id)).toEqual({ day: null, month: null, year: null });
  });

  it("stores a day, a month and a year", async () => {
    const id = await addContact(user, "Анна", { birthDay: 14, birthMonth: 3, birthYear: 1990 });

    expect(await birthdayOf(id)).toEqual({ day: 14, month: 3, year: 1990 });
  });

  it("stores a day and a month without a year", async () => {
    const id = await addContact(user, "Анна", { birthDay: 29, birthMonth: 2 });

    expect(await birthdayOf(id)).toEqual({ day: 29, month: 2, year: null });
  });

  it.each([
    ["month 13", { birthDay: 1, birthMonth: 13 }],
    ["month 0", { birthDay: 1, birthMonth: 0 }],
    ["day 0", { birthDay: 0, birthMonth: 3 }],
    ["day 32", { birthDay: 32, birthMonth: 1 }],
    ["day 31 in April", { birthDay: 31, birthMonth: 4 }],
    ["day 30 in February", { birthDay: 30, birthMonth: 2 }],
    ["a day without a month", { birthDay: 14 }],
    ["a month without a day", { birthMonth: 3 }],
    ["a year without a day and a month", { birthYear: 1990 }],
    ["year 1899", { birthDay: 14, birthMonth: 3, birthYear: 1899 }],
  ])("rejects %s", async (_name, values) => {
    await expect(addContact(user, "Анна", values)).rejects.toMatchObject(checkViolation);
  });
});
