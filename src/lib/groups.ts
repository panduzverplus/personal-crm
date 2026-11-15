import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { contactGroups, contacts, groups } from "@/db/schema";

// Every function takes the id of the current user first and works only with that user's groups.
// A group of another user is answered as a group that does not exist.

/** Groups go by name everywhere they are shown. */
const byName = sql`${groups.name} collate "ru-x-icu"`;

/** All groups of the user in alphabetical order. */
export async function listGroups(userId: string) {
  await connection();

  return db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.ownerId, userId))
    .orderBy(byName, groups.id);
}

/** All groups of the user in alphabetical order, each with the number of its contacts (0 for an empty one). */
export async function listGroupsWithCounts(userId: string) {
  await connection();

  return db
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contacts.id),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .leftJoin(contacts, and(eq(contacts.id, contactGroups.contactId), eq(contacts.ownerId, userId)))
    .where(eq(groups.ownerId, userId))
    .groupBy(groups.id)
    .orderBy(byName, groups.id);
}

export type InsertGroupResult =
  { status: "created"; group: { id: number; name: string } } | { status: "duplicate" };

/**
 * Creates a group of the user; `name` is already checked. A name that the same user already has,
 * in any letter case, is a duplicate; another user's groups do not count.
 */
export async function insertGroup(userId: string, name: string): Promise<InsertGroupResult> {
  try {
    const [group] = await db
      .insert(groups)
      .values({ ownerId: userId, name })
      .returning({ id: groups.id, name: groups.name });
    return { status: "created", group };
  } catch (error) {
    // The unique index on owner and normalized name rejects the duplicate, even for two requests at once.
    if (isUniqueViolation(error)) {
      return { status: "duplicate" };
    }
    throw error;
  }
}

export type RenameGroupResult =
  { status: "renamed" } | { status: "duplicate" } | { status: "not-found" };

/** Renames a group of the user; `name` is already checked. Its contacts stay in it. */
export async function renameGroupById(
  userId: string,
  id: number,
  name: string,
): Promise<RenameGroupResult> {
  try {
    const rows = await db
      .update(groups)
      .set({ name })
      .where(and(eq(groups.id, id), eq(groups.ownerId, userId)))
      .returning({ id: groups.id });
    return rows.length > 0 ? { status: "renamed" } : { status: "not-found" };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: "duplicate" };
    }
    throw error;
  }
}

/**
 * Deletes the group; its contacts stay and only leave the group (the links go by cascade).
 * Returns false when the user has no such group.
 */
export async function deleteGroupById(userId: string, id: number) {
  const rows = await db
    .delete(groups)
    .where(and(eq(groups.id, id), eq(groups.ownerId, userId)))
    .returning({ id: groups.id });
  return rows.length > 0;
}
