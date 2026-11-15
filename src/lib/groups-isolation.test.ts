import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addGroup, addToGroup, addUser } from "@/test/factories";
import {
  deleteGroupById,
  insertGroup,
  listGroups,
  listGroupsWithCounts,
  renameGroupById,
} from "./groups";

// Two users, A and B. A has the groups "Друзья" and "Теннис"; B asks for them and must get
// what he would get for groups that do not exist.

let a: string;
let b: string;
let friendsId: number;
let tennisId: number;

beforeEach(async () => {
  await resetDatabase();
  a = await addUser("a@example.com");
  b = await addUser("b@example.com");
  friendsId = await addGroup(a, "Друзья");
  tennisId = await addGroup(a, "Теннис");
});

async function namesOf(owner: string) {
  return (await listGroups(owner)).map((group) => group.name);
}

describe("a user sees only own groups", () => {
  it("lists and counts the groups of the user, not of another one", async () => {
    const anna = await addContact(a, "Анна");
    await addToGroup(anna, tennisId);
    const own = await addGroup(b, "Коллеги");

    expect(await listGroups(b)).toEqual([{ id: own, name: "Коллеги" }]);
    expect(await listGroupsWithCounts(b)).toEqual([{ id: own, name: "Коллеги", contactCount: 0 }]);
    expect(await listGroupsWithCounts(a)).toEqual([
      { id: friendsId, name: "Друзья", contactCount: 0 },
      { id: tennisId, name: "Теннис", contactCount: 1 },
    ]);
  });

  it("starts a new user without groups", async () => {
    const newcomer = await addUser("new@example.com");

    expect(await listGroups(newcomer)).toEqual([]);
    expect(await listGroupsWithCounts(newcomer)).toEqual([]);
  });
});

describe("the same name for different users", () => {
  it("creates a group that another user already has", async () => {
    const result = await insertGroup(b, "Друзья");

    expect(result).toEqual({
      status: "created",
      group: { id: expect.any(Number), name: "Друзья" },
    });
    expect(await namesOf(a)).toEqual(["Друзья", "Теннис"]);
    expect(await namesOf(b)).toEqual(["Друзья"]);
  });

  it("renames own group to the name of a group of another user", async () => {
    const own = await addGroup(b, "Коллеги");

    expect(await renameGroupById(b, own, "Теннис")).toEqual({ status: "renamed" });
    expect(await namesOf(b)).toEqual(["Теннис"]);
    expect(await namesOf(a)).toEqual(["Друзья", "Теннис"]);
  });

  it("renaming a group does not touch the group of another user with the same name", async () => {
    const boris = await insertGroup(b, "Друзья");
    expect(boris.status).toBe("created");

    expect(await renameGroupById(a, friendsId, "Близкие")).toEqual({ status: "renamed" });

    expect(await namesOf(a)).toEqual(["Близкие", "Теннис"]);
    expect(await namesOf(b)).toEqual(["Друзья"]);
  });

  it("still rejects a duplicate inside the groups of one user", async () => {
    expect(await insertGroup(a, "друзья")).toEqual({ status: "duplicate" });

    const other = await addGroup(a, "Семья");
    expect(await renameGroupById(a, other, "теннис")).toEqual({ status: "duplicate" });
  });
});

describe("a request with an id of another user changes nothing", () => {
  it("renameGroupById answers as for a missing group", async () => {
    expect(await renameGroupById(b, friendsId, "Взломано")).toEqual({ status: "not-found" });

    expect(await namesOf(a)).toEqual(["Друзья", "Теннис"]);
  });

  it("deleteGroupById answers as for a missing group", async () => {
    const anna = await addContact(a, "Анна");
    await addToGroup(anna, tennisId);

    expect(await deleteGroupById(b, tennisId)).toBe(false);

    expect(await db.select().from(groups)).toHaveLength(2);
    expect(await db.select().from(contactGroups)).toEqual([{ contactId: anna, groupId: tennisId }]);
  });

  it("deleteGroupById still deletes an own group", async () => {
    expect(await deleteGroupById(a, tennisId)).toBe(true);
    expect(await namesOf(a)).toEqual(["Друзья"]);
  });
});
