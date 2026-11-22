import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  contactGroups,
  contacts,
  groups,
  loginEmailSends,
  notes,
  sessions,
  users,
  verifications,
} from "../src/db/schema";
import { getE2eDatabaseUrl } from "../src/test/test-database-url";

/** The person the scenarios log in as, unless a test needs several people. */
export const E2E_USER = "tester@example.com";

type Db = ReturnType<typeof drizzle>;

async function withDb<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const client = postgres(getE2eDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    return await work(drizzle(client));
  } finally {
    await client.end();
  }
}

/** The id of the user with the address; the user is created if the person has not logged in yet. */
async function ensureUser(db: Db, email: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    return existing.id;
  }
  const [created] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "", email, emailVerified: true })
    .returning({ id: users.id });
  return created.id;
}

/** Leaves exactly these contacts of the user, without notes, in the e2e database. */
export async function resetContacts(names: string[], email: string = E2E_USER) {
  await withDb(async (db) => {
    const owner = await ensureUser(db, email);
    await db.execute(sql`truncate table ${contacts} restart identity cascade`);
    await db.insert(contacts).values(names.map((name) => ({ ownerId: owner, name })));
  });
}

export type SeedContact = {
  name: string;
  frequency?: "week" | "month" | "quarter" | "year";
  createdAt?: Date;
  /** When the only note of the contact was written; no note when not set. */
  noteAt?: Date;
  group?: string;
  /** The year may be left out, as in the app. */
  birthday?: { day: number; month: number; year?: number };
};

/**
 * Leaves exactly these contacts and their groups, all of them the user's, in the e2e database.
 * Users and their sessions stay, so a test can log in first. Returns ids by group name.
 */
export async function seedContacts(
  people: SeedContact[],
  extraGroups: string[] = [],
  email: string = E2E_USER,
) {
  return withDb(async (db) => {
    const owner = await ensureUser(db, email);
    await db.execute(sql`truncate table ${contacts}, ${groups} restart identity cascade`);

    const groupNames = [
      ...new Set([...people.flatMap(({ group }) => (group ? [group] : [])), ...extraGroups]),
    ];
    const groupIds = new Map<string, number>();
    for (const name of groupNames) {
      const [row] = await db
        .insert(groups)
        .values({ ownerId: owner, name })
        .returning({ id: groups.id });
      groupIds.set(name, row.id);
    }

    for (const { name, frequency, createdAt, noteAt, group, birthday } of people) {
      const [row] = await db
        .insert(contacts)
        .values({
          ownerId: owner,
          name,
          contactFrequency: frequency,
          createdAt,
          birthDay: birthday?.day,
          birthMonth: birthday?.month,
          birthYear: birthday?.year,
        })
        .returning({ id: contacts.id });
      if (noteAt) {
        await db.insert(notes).values({ contactId: row.id, body: "Заметка", createdAt: noteAt });
      }
      if (group) {
        await db.insert(contactGroups).values({ contactId: row.id, groupId: groupIds.get(group)! });
      }
    }
    return groupIds;
  });
}

/** Adds one contact to the user (created if needed) and returns the contact id. */
export async function addContactFor(email: string, name: string) {
  return withDb(async (db) => {
    const owner = await ensureUser(db, email);
    const [row] = await db
      .insert(contacts)
      .values({ ownerId: owner, name })
      .returning({ id: contacts.id });
    return row.id;
  });
}

/** Adds a group to the user (created if needed) and returns the group id. */
export async function addGroupFor(email: string, name: string) {
  return withDb(async (db) => {
    const owner = await ensureUser(db, email);
    const [row] = await db
      .insert(groups)
      .values({ ownerId: owner, name })
      .returning({ id: groups.id });
    return row.id;
  });
}

/** Removes everything of every user: contacts, groups, users, sessions, login links and letters. */
export async function resetEverything() {
  await withDb(async (db) => {
    await db.execute(
      sql`truncate table ${users}, ${contacts}, ${groups}, ${verifications}, ${loginEmailSends} restart identity cascade`,
    );
  });
}

/** Forgets the login links and the record of sent letters (the limit of three letters). */
export async function clearLoginState() {
  await withDb(async (db) => {
    await db.execute(sql`truncate table ${verifications}, ${loginEmailSends}`);
  });
}

// The times below are moved in the database instead of waiting for the real minutes and days.

/** Makes the login links `minutes` older: a link that is 15 minutes old stops working. */
export async function ageLoginLinks(minutes: number) {
  await withDb(async (db) => {
    await db.execute(sql`update ${verifications}
      set created_at = created_at - make_interval(mins => ${minutes}),
          expires_at = expires_at - make_interval(mins => ${minutes})`);
  });
}

/** Makes the record of sent letters `minutes` older: after 10 minutes a letter is not counted. */
export async function ageSentLetters(minutes: number) {
  await withDb(async (db) => {
    await db.execute(sql`update ${loginEmailSends}
      set sent_at = sent_at - make_interval(mins => ${minutes})`);
  });
}

/** Makes every session of the user `days` older, as if the last visit was `days` days ago. */
export async function ageSessions(email: string, days: number) {
  await withDb(async (db) => {
    await db.execute(sql`update ${sessions}
      set created_at = created_at - make_interval(days => ${days}),
          updated_at = updated_at - make_interval(days => ${days}),
          expires_at = expires_at - make_interval(days => ${days})
      where user_id = (select id from ${users} where email = ${email})`);
  });
}

export async function sessionsOf(email: string) {
  return withDb((db) =>
    db
      .select({ id: sessions.id, expiresAt: sessions.expiresAt, updatedAt: sessions.updatedAt })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(users.email, email)),
  );
}

export async function userCount() {
  return withDb(async (db) => (await db.select({ id: users.id }).from(users)).length);
}
