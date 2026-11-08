import { describe, expect, it } from "vitest";
import { contactFormFrom, emptyContactForm, parseGroupIds } from "./contact-form";

describe("parseGroupIds", () => {
  it("returns an empty list when nothing is checked", () => {
    expect(parseGroupIds([])).toEqual([]);
  });

  it("returns the ids as numbers, in the order they came", () => {
    expect(parseGroupIds(["3", "1", "2"])).toEqual([3, 1, 2]);
  });

  it("drops repeated ids", () => {
    expect(parseGroupIds(["2", "5", "2", "5"])).toEqual([2, 5]);
  });

  it.each(["", "abc", "-1", "0", "1.5", "3abc", "99999999999"])(
    "drops the junk value %j",
    (value) => {
      expect(parseGroupIds(["7", value])).toEqual([7]);
    },
  );

  it("drops files", () => {
    expect(parseGroupIds([new File([], "a.txt"), "4"])).toEqual([4]);
  });
});

describe("form state with groups", () => {
  it("starts an empty form without groups", () => {
    expect(emptyContactForm.groupIds).toEqual([]);
  });

  it("pre-fills the form with the groups of a saved contact", () => {
    const state = contactFormFrom(
      {
        name: "Анна",
        about: null,
        howWeMet: null,
        phone: null,
        email: null,
        contactFrequency: null,
      },
      [3, 5],
    );

    expect(state.values.name).toBe("Анна");
    expect(state.groupIds).toEqual([3, 5]);
  });
});
