import { describe, expect, it } from "vitest";
import { pluralize } from "./format";

describe("pluralize", () => {
  const forms: [string, string, string] = ["контакт", "контакта", "контактов"];

  it("picks the form for one", () => {
    expect(pluralize(1, forms)).toBe("1 контакт");
  });

  it("picks the form for 2 to 4", () => {
    expect(pluralize(3, forms)).toBe("3 контакта");
  });

  it("picks the form for 5 and more, and for zero", () => {
    expect(pluralize(5, forms)).toBe("5 контактов");
    expect(pluralize(0, forms)).toBe("0 контактов");
  });

  it("treats 11 to 14 as many", () => {
    expect(pluralize(11, forms)).toBe("11 контактов");
  });
});
