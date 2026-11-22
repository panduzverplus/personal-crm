import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactFormFrom, contactSchema, emptyContactForm, parseGroupIds } from "./contact-form";

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
        birthDay: null,
        birthMonth: null,
        birthYear: null,
      },
      [3, 5],
    );

    expect(state.values.name).toBe("Анна");
    expect(state.groupIds).toEqual([3, 5]);
  });
});

describe("contact frequency in the form", () => {
  const filledForm = {
    name: "Анна",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    birthday: "",
  };

  it("pre-fills the form with the saved frequency", () => {
    const state = contactFormFrom(
      {
        name: "Анна",
        about: null,
        howWeMet: null,
        phone: null,
        email: null,
        contactFrequency: "quarter",
        birthDay: null,
        birthMonth: null,
        birthYear: null,
      },
      [],
    );

    expect(state.values.contactFrequency).toBe("quarter");
  });

  it("starts an empty form without a frequency", () => {
    expect(emptyContactForm.values.contactFrequency).toBe("");
  });

  it("saves an untouched field as no frequency", () => {
    const parsed = contactSchema.parse({ ...filledForm, contactFrequency: "" });

    expect(parsed.contactFrequency).toBeNull();
  });

  it("keeps the chosen frequency", () => {
    const parsed = contactSchema.parse({ ...filledForm, contactFrequency: "month" });

    expect(parsed.contactFrequency).toBe("month");
  });
});

describe("birthday in the form", () => {
  const filledForm = {
    name: "Анна",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    contactFrequency: "",
  };
  const saved = {
    name: "Анна",
    about: null,
    howWeMet: null,
    phone: null,
    email: null,
    contactFrequency: null,
  };

  // "Today" is fixed: the check of the year depends on it.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts an empty form without a birthday", () => {
    expect(emptyContactForm.values.birthday).toBe("");
  });

  it("saves a day, a month and a year as three values", () => {
    const parsed = contactSchema.parse({ ...filledForm, birthday: "14.03.1990" });

    expect(parsed).toMatchObject({ birthDay: 14, birthMonth: 3, birthYear: 1990 });
  });

  it("saves a day and a month without a year", () => {
    const parsed = contactSchema.parse({ ...filledForm, birthday: "14.03" });

    expect(parsed).toMatchObject({ birthDay: 14, birthMonth: 3, birthYear: null });
  });

  it("saves an untouched field as no birthday", () => {
    const parsed = contactSchema.parse({ ...filledForm, birthday: "" });

    expect(parsed).toMatchObject({ birthDay: null, birthMonth: null, birthYear: null });
  });

  it.each([
    ["март", "Введите дату как 14.03 или 14.03.1990"],
    ["31.02", "Введите дату как 14.03 или 14.03.1990"],
    ["14.03.2027", "Год не может быть в будущем"],
    ["14.03.1899", "Год не раньше 1900"],
  ])("rejects %j with a message at the field", (birthday, message) => {
    const result = contactSchema.safeParse({ ...filledForm, birthday });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["birthday"], message }),
    ]);
  });

  it("pre-fills the form with a birthday that has a year", () => {
    const state = contactFormFrom({ ...saved, birthDay: 14, birthMonth: 3, birthYear: 1990 }, []);

    expect(state.values.birthday).toBe("14.03.1990");
  });

  it("pre-fills the form with a birthday without a year", () => {
    const state = contactFormFrom({ ...saved, birthDay: 14, birthMonth: 3, birthYear: null }, []);

    expect(state.values.birthday).toBe("14.03");
  });

  it("pre-fills the form with an empty field when there is no birthday", () => {
    const state = contactFormFrom(
      { ...saved, birthDay: null, birthMonth: null, birthYear: null },
      [],
    );

    expect(state.values.birthday).toBe("");
  });
});
