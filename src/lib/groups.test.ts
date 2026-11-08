import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { contactGroups, contacts } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addContact, addGroup, addToGroup } from "@/test/factories";
import {
  deleteGroupById,
  insertGroup,
  listGroups,
  listGroupsWithCounts,
  renameGroupById,
} from "./groups";

describe("listGroups", () => {
  beforeEach(resetDatabase);

  it("returns an empty list when there are no groups", async () => {
    expect(await listGroups()).toEqual([]);
  });

  it("orders groups by name", async () => {
    await addGroup("Теннис");
    await addGroup("Друзья");
    await addGroup("Коллеги");

    const names = (await listGroups()).map((group) => group.name);
    expect(names).toEqual(["Друзья", "Коллеги", "Теннис"]);
  });

  it("follows the Russian alphabet (ё after е) and ignores letter case", async () => {
    await addGroup("яблоко");
    await addGroup("Жук");
    await addGroup("Ёлка");
    await addGroup("Дом");

    const names = (await listGroups()).map((group) => group.name);
    expect(names).toEqual(["Дом", "Ёлка", "Жук", "яблоко"]);
  });

  it("returns ids with names", async () => {
    const id = await addGroup("Семья");
    expect(await listGroups()).toEqual([{ id, name: "Семья" }]);
  });
});

describe("listGroupsWithCounts", () => {
  beforeEach(resetDatabase);

  it("counts contacts in each group, including empty groups", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const empty = await addGroup("Аналитики");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addContact("Вера");
    await addToGroup(anna, tennis);
    await addToGroup(boris, tennis);
    await addToGroup(anna, family);

    expect(await listGroupsWithCounts()).toEqual([
      { id: empty, name: "Аналитики", contactCount: 0 },
      { id: family, name: "Семья", contactCount: 1 },
      { id: tennis, name: "Теннис", contactCount: 2 },
    ]);
  });

  it("counts a contact once in every group it belongs to", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    const counts = (await listGroupsWithCounts()).map((g) => g.contactCount);
    expect(counts).toEqual([1, 1]);
  });
});

describe("insertGroup", () => {
  beforeEach(resetDatabase);

  it("creates a group and returns it", async () => {
    const result = await insertGroup("Коллеги");

    expect(result).toEqual({
      status: "created",
      group: { id: expect.any(Number), name: "Коллеги" },
    });
    expect((await listGroups()).map((group) => group.name)).toEqual(["Коллеги"]);
  });

  it("puts the new group in alphabetical order", async () => {
    await addGroup("Друзья");
    await addGroup("Теннис");

    await insertGroup("Коллеги");

    expect((await listGroups()).map((group) => group.name)).toEqual([
      "Друзья",
      "Коллеги",
      "Теннис",
    ]);
  });

  it("reports a duplicate that differs only by letter case", async () => {
    await addGroup("Теннис");

    expect(await insertGroup("теннис")).toEqual({ status: "duplicate" });
    expect(await listGroups()).toHaveLength(1);
  });

  it("reports a duplicate that differs only by е and ё", async () => {
    await addGroup("Алёна и друзья");

    expect(await insertGroup("алена и друзья")).toEqual({
      status: "duplicate",
    });
    expect(await listGroups()).toHaveLength(1);
  });
});

describe("renameGroupById", () => {
  beforeEach(resetDatabase);

  it("renames the group", async () => {
    const id = await addGroup("Теннис");

    expect(await renameGroupById(id, "Большой теннис")).toEqual({
      status: "renamed",
    });
    expect(await listGroups()).toEqual([{ id, name: "Большой теннис" }]);
  });

  it("keeps the contacts in the renamed group", async () => {
    const id = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await addToGroup(anna, id);

    await renameGroupById(id, "Большой теннис");

    expect(await listGroupsWithCounts()).toEqual([{ id, name: "Большой теннис", contactCount: 1 }]);
  });

  it("lets a group change only the letter case of its own name", async () => {
    const id = await addGroup("теннис");

    expect(await renameGroupById(id, "Теннис")).toEqual({ status: "renamed" });
    expect(await listGroups()).toEqual([{ id, name: "Теннис" }]);
  });

  it("lets a group change only е and ё in its own name", async () => {
    const id = await addGroup("Алена");

    expect(await renameGroupById(id, "Алёна")).toEqual({ status: "renamed" });
  });

  it("reports a name taken by another group and changes nothing", async () => {
    const friends = await addGroup("Друзья");
    await addGroup("Семья");

    expect(await renameGroupById(friends, "семья")).toEqual({
      status: "duplicate",
    });
    expect((await listGroups()).map((group) => group.name)).toEqual(["Друзья", "Семья"]);
  });

  it("reports a group that does not exist", async () => {
    expect(await renameGroupById(12345, "Теннис")).toEqual({
      status: "not-found",
    });
  });
});

describe("deleteGroupById", () => {
  beforeEach(resetDatabase);

  it("deletes the group but keeps its contacts and their other groups", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addToGroup(anna, tennis);
    await addToGroup(anna, family);

    expect(await deleteGroupById(tennis)).toBe(true);

    expect(await listGroups()).toEqual([{ id: family, name: "Семья" }]);
    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(contactGroups)).toEqual([{ contactId: anna, groupId: family }]);
  });

  it("returns false when the group does not exist", async () => {
    expect(await deleteGroupById(12345)).toBe(false);
  });
});
