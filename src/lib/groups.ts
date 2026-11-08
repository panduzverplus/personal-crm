import "server-only";
import { count, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { contactGroups, groups } from "@/db/schema";

/** Groups go by name everywhere they are shown. */
const byName = sql`${groups.name} collate "ru-x-icu"`;

/** All groups in alphabetical order. */
export async function listGroups() {
  await connection();

  return db.select({ id: groups.id, name: groups.name }).from(groups).orderBy(byName, groups.id);
}

/** All groups in alphabetical order, each with the number of its contacts (0 for an empty one). */
export async function listGroupsWithCounts() {
  await connection();

  return db
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: count(contactGroups.contactId),
    })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(byName, groups.id);
}

export type InsertGroupResult =
  { status: "created"; group: { id: number; name: string } } | { status: "duplicate" };

/** Creates a group; `name` is already checked. A name that exists in any letter case is a duplicate. */
export async function insertGroup(name: string): Promise<InsertGroupResult> {
  try {
    const [group] = await db
      .insert(groups)
      .values({ name })
      .returning({ id: groups.id, name: groups.name });
    return { status: "created", group };
  } catch (error) {
    // The unique index on the normalized name rejects the duplicate, even for two requests at once.
    if (isUniqueViolation(error)) {
      return { status: "duplicate" };
    }
    throw error;
  }
}

export type RenameGroupResult =
  { status: "renamed" } | { status: "duplicate" } | { status: "not-found" };

/** Renames a group; `name` is already checked. Its contacts stay in it. */
export async function renameGroupById(id: number, name: string): Promise<RenameGroupResult> {
  try {
    const rows = await db
      .update(groups)
      .set({ name })
      .where(eq(groups.id, id))
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
 * Returns false when the group does not exist.
 */
export async function deleteGroupById(id: number) {
  const rows = await db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
  return rows.length > 0;
}
