import { describe, expect, it } from "vitest";
import {
  isListNarrowed,
  listQueryString,
  pathWithListParams,
  parseListParams,
} from "./list-params";

describe("parseListParams", () => {
  it("returns no group and an empty query when nothing is set", () => {
    expect(parseListParams({})).toEqual({ group: null, q: "" });
  });

  it("reads the group id and the query", () => {
    expect(parseListParams({ group: "3", q: "Анна" })).toEqual({
      group: 3,
      q: "Анна",
    });
  });

  it("treats an empty group as no group", () => {
    expect(parseListParams({ group: "" }).group).toBeNull();
  });

  it.each(["abc", "-1", "0", "1.5", "3abc", " 3", "1e2", "99999999999"])(
    "treats %j as no group",
    (value) => {
      expect(parseListParams({ group: value }).group).toBeNull();
    },
  );

  it("takes the first value when a parameter is repeated", () => {
    expect(parseListParams({ group: ["4", "5"], q: ["a", "b"] })).toEqual({
      group: 4,
      q: "a",
    });
  });

  it("treats an empty list of values as missing", () => {
    expect(parseListParams({ group: [], q: [] })).toEqual({
      group: null,
      q: "",
    });
  });

  it("trims spaces around the query and keeps Cyrillic as is", () => {
    expect(parseListParams({ q: "  Анна  Петрова " }).q).toBe("Анна  Петрова");
  });

  it("treats a query of spaces only as empty", () => {
    expect(parseListParams({ q: "   " }).q).toBe("");
  });
});

describe("listQueryString", () => {
  it("is empty when the list is not narrowed, without a question mark", () => {
    expect(listQueryString({ group: null, q: "" })).toBe("");
  });

  it("contains only the group", () => {
    expect(listQueryString({ group: 3, q: "" })).toBe("?group=3");
  });

  it("contains only the query", () => {
    expect(listQueryString({ group: null, q: "Анна" })).toBe(`?q=${encodeURIComponent("Анна")}`);
  });

  it("contains both, group first", () => {
    expect(listQueryString({ group: 3, q: "Анна" })).toBe(
      `?group=3&q=${encodeURIComponent("Анна")}`,
    );
  });

  it("encodes spaces and reserved characters", () => {
    const query = listQueryString({ group: null, q: "а&б=в #1" });
    expect(query.startsWith("?q=")).toBe(true);
    expect(query).not.toMatch(/[ #&]/);
    expect(new URLSearchParams(query).get("q")).toBe("а&б=в #1");
  });

  it("round-trips through parseListParams", () => {
    const params = { group: 12, q: "Анна Петрова" };
    const query = new URLSearchParams(listQueryString(params));
    expect(parseListParams(Object.fromEntries(query))).toEqual(params);
  });
});

describe("isListNarrowed", () => {
  it("is false without a group and a query", () => {
    expect(isListNarrowed({ group: null, q: "" })).toBe(false);
  });

  it("is true with a group or with a query", () => {
    expect(isListNarrowed({ group: 3, q: "" })).toBe(true);
    expect(isListNarrowed({ group: null, q: "Анна" })).toBe(true);
  });
});

describe("pathWithListParams", () => {
  it("leaves the path alone when the list is not narrowed", () => {
    expect(pathWithListParams("/contacts/5", { group: null, q: "" })).toBe("/contacts/5");
  });

  it("adds the group and the query", () => {
    expect(pathWithListParams("/contacts/5", { group: 3, q: "Анна" })).toBe(
      `/contacts/5?group=3&q=${encodeURIComponent("Анна")}`,
    );
  });

  it("adds extra parameters after the list parameters", () => {
    expect(pathWithListParams("/contacts/5", { group: 3, q: "" }, { updated: "1" })).toBe(
      "/contacts/5?group=3&updated=1",
    );
  });

  it("starts the query with a question mark when only extra parameters are given", () => {
    expect(pathWithListParams("/", { group: null, q: "" }, { deleted: "Анна" })).toBe(
      `/?deleted=${encodeURIComponent("Анна")}`,
    );
  });

  it("encodes extra values", () => {
    const path = pathWithListParams("/", { group: null, q: "" }, { deleted: "а&б #1" });
    expect(new URLSearchParams(path.slice(2)).get("deleted")).toBe("а&б #1");
  });
});
