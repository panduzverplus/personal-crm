import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { contactGroups, contacts } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addGroup, addToGroup, addUser } from "@/test/factories";
import {
  deleteGroupById,
  insertGroup,
  listGroups,
  listGroupsWithCounts,
  renameGroupById,
} from "./groups";

// The user whose groups these tests work with. Other users are in groups-isolation.test.ts.
let user: string;

async function setUp() {
  await resetDatabase();
  user = await addUser("anna@example.com");
}

describe("listGroups", () => {
  beforeEach(setUp);

  it("returns an empty list when there are no groups", async () => {
    expect(await listGroups(user)).toEqual([]);
  });

  it("orders groups by name", async () => {
    await addGroup(user, "Теннис");
    await addGroup(user, "Друзья");
    await addGroup(user, "Коллеги");

    const names = (await listGroups(user)).map((group) => group.name);
    expect(names).toEqual(["Друзья", "Коллеги", "Теннис"]);
  });

  it("follows the Russian alphabet (ё after е) and ignores letter case", async () => {
    await addGroup(user, "яблоко");
    await addGroup(user, "Жук");
    await addGroup(user, "Ёлка");
    await addGroup(user, "Дом");

    const names = (await listGroups(user)).map((group) => group.name);
    expect(names).toEqual(["Дом", "Ёлка", "Жук", "яблоко"]);
  });

  it("returns ids with names", async () => {
    const id = await addGroup(user, "Семья");
    expect(await listGroups(user)).toEqual([{ id, name: "Семья" }]);
  });
});

describe("listGroupsWithCounts", () => {
  beforeEach(setUp);

  it("counts contacts in each group, including empty groups", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const empty = await addGroup(user, "Аналитики");
    const anna = await addContact(user, "Анна");
    const boris = await addContact(user, "Борис");
    await addContact(user, "Вера");
    await addToGroup(anna, tennis);
    await addToGroup(boris, tennis);
    await addToGroup(anna, family);

    expect(await listGroupsWithCounts(user)).toEqual([
      { id: empty, name: "Аналитики", contactCount: 0 },
      { id: family, name: "Семья", contactCount: 1 },
      { id: tennis, name: "Теннис", contactCount: 2 },
    ]);
  });

  it("counts a contact once in every group it belongs to", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const counts = (await listGroupsWithCounts(user)).map((g) => g.contactCount);
    expect(counts).toEqual([1, 1]);
  });
});

describe("insertGroup", () => {
  beforeEach(setUp);

  it("creates a group and returns it", async () => {
    const result = await insertGroup(user, "Коллеги");

    expect(result).toEqual({
      status: "created",
      group: { id: expect.any(Number), name: "Коллеги" },
    });
    expect((await listGroups(user)).map((group) => group.name)).toEqual(["Коллеги"]);
  });

  it("puts the new group in alphabetical order", async () => {
    await addGroup(user, "Друзья");
    await addGroup(user, "Теннис");

    await insertGroup(user, "Коллеги");

    expect((await listGroups(user)).map((group) => group.name)).toEqual([
      "Друзья",
      "Коллеги",
      "Теннис",
    ]);
  });

  it("reports a duplicate that differs only by letter case", async () => {
    await addGroup(user, "Теннис");

    expect(await insertGroup(user, "теннис")).toEqual({ status: "duplicate" });
    expect(await listGroups(user)).toHaveLength(1);
  });

  it("reports a duplicate that differs only by е and ё", async () => {
    await addGroup(user, "Алёна и друзья");

    expect(await insertGroup(user, "алена и друзья")).toEqual({
      status: "duplicate",
    });
    expect(await listGroups(user)).toHaveLength(1);
  });
});

describe("renameGroupById", () => {
  beforeEach(setUp);

  it("renames the group", async () => {
    const id = await addGroup(user, "Теннис");

    expect(await renameGroupById(user, id, "Большой теннис")).toEqual({
      status: "renamed",
    });
    expect(await listGroups(user)).toEqual([{ id, name: "Большой теннис" }]);
  });

  it("keeps the contacts in the renamed group", async () => {
    const id = await addGroup(user, "Теннис");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, id);

    await renameGroupById(user, id, "Большой теннис");

    expect(await listGroupsWithCounts(user)).toEqual([
      { id, name: "Большой теннис", contactCount: 1 },
    ]);
  });

  it("lets a group change only the letter case of its own name", async () => {
    const id = await addGroup(user, "теннис");

    expect(await renameGroupById(user, id, "Теннис")).toEqual({ status: "renamed" });
    expect(await listGroups(user)).toEqual([{ id, name: "Теннис" }]);
  });

  it("lets a group change only е and ё in its own name", async () => {
    const id = await addGroup(user, "Алена");

    expect(await renameGroupById(user, id, "Алёна")).toEqual({ status: "renamed" });
  });

  it("reports a name taken by another group and changes nothing", async () => {
    const friends = await addGroup(user, "Друзья");
    await addGroup(user, "Семья");

    expect(await renameGroupById(user, friends, "семья")).toEqual({
      status: "duplicate",
    });
    expect((await listGroups(user)).map((group) => group.name)).toEqual(["Друзья", "Семья"]);
  });

  it("reports a group that does not exist", async () => {
    expect(await renameGroupById(user, 12345, "Теннис")).toEqual({
      status: "not-found",
    });
  });
});

describe("deleteGroupById", () => {
  beforeEach(setUp);

  it("deletes the group but keeps its contacts and their other groups", async () => {
    const tennis = await addGroup(user, "Теннис");
    const family = await addGroup(user, "Семья");
    const anna = await addContact(user, "Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    expect(await deleteGroupById(user, tennis)).toBe(true);

    expect(await listGroups(user)).toEqual([{ id: family, name: "Семья" }]);
    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(contactGroups)).toEqual([{ contactId: anna, groupId: family }]);
  });

  it("returns false when the group does not exist", async () => {
    expect(await deleteGroupById(user, 12345)).toBe(false);
  });
});
