import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  birthdayRowDetails,
  birthdayWindow,
  formatBirthdayInput,
  formatBirthdayLong,
  matchWindow,
  parseBirthday,
} from "./birthday";

const FORMAT_ERROR = "Введите дату как 14.03 или 14.03.1990";

// "Today" is fixed, so the checks of the year do not depend on when the tests run.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 22, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseBirthday", () => {
  it("reads a day, a month and a year", () => {
    expect(parseBirthday("14.03.1990")).toEqual({
      ok: true,
      birthday: { day: 14, month: 3, year: 1990 },
    });
  });

  it("reads a day and a month without a year", () => {
    expect(parseBirthday("14.03")).toEqual({
      ok: true,
      birthday: { day: 14, month: 3, year: null },
    });
  });

  it("accepts a day and a month without a leading zero and trims spaces", () => {
    expect(parseBirthday(" 5.3.1990 ")).toEqual({
      ok: true,
      birthday: { day: 5, month: 3, year: 1990 },
    });
  });

  it("treats an empty value as no birthday", () => {
    expect(parseBirthday("")).toEqual({ ok: true, birthday: null });
    expect(parseBirthday("   ")).toEqual({ ok: true, birthday: null });
  });

  it.each(["март", "14/03/1990", "14.03.90", "14-03", "14.03.1990.1", "1990.03.14", "14.3."])(
    "rejects the wrong format %j",
    (value) => {
      expect(parseBirthday(value)).toEqual({ ok: false, message: FORMAT_ERROR });
    },
  );

  it.each(["31.02", "32.01", "14.13", "00.03", "14.00", "31.04", "30.02.1990"])(
    "rejects the date that does not exist %j",
    (value) => {
      expect(parseBirthday(value)).toEqual({ ok: false, message: FORMAT_ERROR });
    },
  );

  it("rejects a year in the future", () => {
    expect(parseBirthday("14.03.2027")).toEqual({
      ok: false,
      message: "Год не может быть в будущем",
    });
  });

  it("accepts the current year", () => {
    expect(parseBirthday("14.03.2026")).toEqual({
      ok: true,
      birthday: { day: 14, month: 3, year: 2026 },
    });
  });

  it("rejects a year before 1900", () => {
    expect(parseBirthday("14.03.1899")).toEqual({ ok: false, message: "Год не раньше 1900" });
  });

  it("accepts 1900", () => {
    expect(parseBirthday("14.03.1900")).toEqual({
      ok: true,
      birthday: { day: 14, month: 3, year: 1900 },
    });
  });

  it("accepts February 29 with a leap year and without a year", () => {
    expect(parseBirthday("29.02.2000")).toEqual({
      ok: true,
      birthday: { day: 29, month: 2, year: 2000 },
    });
    expect(parseBirthday("29.02")).toEqual({
      ok: true,
      birthday: { day: 29, month: 2, year: null },
    });
  });

  it("rejects February 29 with a year that was not a leap year", () => {
    expect(parseBirthday("29.02.2001")).toEqual({ ok: false, message: FORMAT_ERROR });
    // 1900 was not a leap year: divisible by 100 but not by 400.
    expect(parseBirthday("29.02.1900")).toEqual({ ok: false, message: FORMAT_ERROR });
  });
});

describe("formatBirthdayInput", () => {
  it("writes a day, a month and a year with leading zeros", () => {
    expect(formatBirthdayInput({ day: 5, month: 3, year: 1990 })).toBe("05.03.1990");
  });

  it("writes a day and a month when the year is not known", () => {
    expect(formatBirthdayInput({ day: 14, month: 3, year: null })).toBe("14.03");
  });

  it("writes nothing when there is no birthday", () => {
    expect(formatBirthdayInput(null)).toBe("");
  });

  it("gives text that parses back to the same birthday", () => {
    const birthday = { day: 29, month: 2, year: 2000 };
    expect(parseBirthday(formatBirthdayInput(birthday))).toEqual({ ok: true, birthday });
  });
});

describe("birthdayWindow", () => {
  it("lists eight days in a row from today", () => {
    const window = birthdayWindow(new Date(2026, 10, 22, 15, 30));

    expect(window).toHaveLength(8);
    expect(window.map(({ day, month, daysAhead }) => [daysAhead, month, day])).toEqual([
      [0, 11, 22],
      [1, 11, 23],
      [2, 11, 24],
      [3, 11, 25],
      [4, 11, 26],
      [5, 11, 27],
      [6, 11, 28],
      [7, 11, 29],
    ]);
  });

  it("goes over the end of the year", () => {
    const window = birthdayWindow(new Date(2026, 11, 28));

    expect(window.map(({ month, day }) => [month, day])).toEqual([
      [12, 28],
      [12, 29],
      [12, 30],
      [12, 31],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ]);
    expect(window[4].date.getFullYear()).toBe(2027);
  });
});

describe("matchWindow", () => {
  const today = new Date(2026, 10, 22);
  const window = birthdayWindow(today);
  const at = (day: number, month: number, year: number | null = null) =>
    matchWindow({ day, month, year }, window);

  it("matches a birthday today", () => {
    expect(at(22, 11)).toMatchObject({ daysAhead: 0 });
  });

  it("matches a birthday in 7 days", () => {
    expect(at(29, 11)).toMatchObject({ daysAhead: 7 });
  });

  it("does not match a birthday in 8 days", () => {
    expect(at(30, 11)).toBeNull();
  });

  it("does not match a birthday yesterday", () => {
    expect(at(21, 11)).toBeNull();
  });

  it("matches a birthday in the new year when the window crosses the end of the year", () => {
    const match = matchWindow(
      { day: 3, month: 1, year: null },
      birthdayWindow(new Date(2026, 11, 28)),
    );

    expect(match).toMatchObject({ daysAhead: 6 });
    expect(match?.date).toEqual(new Date(2027, 0, 3));
  });

  it("does not depend on whether the year of birth is known", () => {
    expect(at(25, 11)).toMatchObject({ daysAhead: 3 });
    expect(at(25, 11, 1990)).toMatchObject({ daysAhead: 3 });
  });

  it("counts a birthday on February 29 as February 28 when the year has no February 29", () => {
    const match = matchWindow(
      { day: 29, month: 2, year: null },
      birthdayWindow(new Date(2027, 1, 24)),
    );

    expect(match).toMatchObject({ daysAhead: 4 });
    expect(match?.date).toEqual(new Date(2027, 1, 28));
  });

  it("keeps a birthday on February 29 on February 29 in a leap year", () => {
    const match = matchWindow(
      { day: 29, month: 2, year: null },
      birthdayWindow(new Date(2028, 1, 24)),
    );

    expect(match).toMatchObject({ daysAhead: 5 });
    expect(match?.date).toEqual(new Date(2028, 1, 29));
  });

  it("does not match a birthday on February 28 in a leap year when only February 29 is in the window", () => {
    // 2028-02-29 .. 2028-03-07: February 28 is already behind.
    expect(
      matchWindow({ day: 28, month: 2, year: null }, birthdayWindow(new Date(2028, 1, 29))),
    ).toBeNull();
  });

  it("gives no age when the year is not known", () => {
    expect(at(25, 11)?.age).toBeNull();
  });

  it("gives the age that the person turns on the birthday", () => {
    expect(at(22, 11, 1990)?.age).toBe(36);
  });

  it("counts the age in the new year when the window crosses the end of the year", () => {
    const match = matchWindow(
      { day: 3, month: 1, year: 1990 },
      birthdayWindow(new Date(2026, 11, 28)),
    );

    expect(match?.age).toBe(37);
  });
});

describe("birthdayRowDetails", () => {
  const match = (daysAhead: number, date: Date, age: number | null) => ({ daysAhead, date, age });

  it("shows today, the date and the age", () => {
    expect(birthdayRowDetails(match(0, new Date(2026, 10, 22), 36))).toBe(
      "сегодня · 22 ноября · исполняется 36",
    );
  });

  it("shows tomorrow and the date, without an age when the year is not known", () => {
    expect(birthdayRowDetails(match(1, new Date(2026, 10, 23), null))).toBe("завтра · 23 ноября");
  });

  it("shows the number of days with the right form of the word", () => {
    expect(birthdayRowDetails(match(2, new Date(2026, 10, 24), null))).toBe(
      "через 2 дня · 24 ноября",
    );
    expect(birthdayRowDetails(match(3, new Date(2026, 10, 25), null))).toBe(
      "через 3 дня · 25 ноября",
    );
    expect(birthdayRowDetails(match(5, new Date(2026, 10, 27), null))).toBe(
      "через 5 дней · 27 ноября",
    );
    expect(birthdayRowDetails(match(7, new Date(2026, 10, 29), null))).toBe(
      "через 7 дней · 29 ноября",
    );
  });
});

describe("formatBirthdayLong", () => {
  it("writes the date with the year", () => {
    expect(formatBirthdayLong({ day: 14, month: 3, year: 1990 })).toBe("14 марта 1990 г.");
  });

  it("writes the day and the month when the year is not known", () => {
    expect(formatBirthdayLong({ day: 14, month: 3, year: null })).toBe("14 марта");
  });

  it("writes February 29 without a year", () => {
    expect(formatBirthdayLong({ day: 29, month: 2, year: null })).toBe("29 февраля");
  });
});
