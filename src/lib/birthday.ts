import { formatDate, pluralize } from "@/lib/format";

// No server-only imports: the contact form (a client component) and the pages use this file.

/** A birthday: day and month always, the year only when it is known. */
export type Birthday = { day: number; month: number; year: number | null };

/** The birthday from the columns of a contact; null when the contact has none. */
export function birthdayFromColumns({
  birthDay,
  birthMonth,
  birthYear,
}: {
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
}): Birthday | null {
  return birthDay === null || birthMonth === null
    ? null
    : { day: birthDay, month: birthMonth, year: birthYear };
}

export type ParsedBirthday =
  { ok: true; birthday: Birthday | null } | { ok: false; message: string };

// Validation messages are shown in the UI, so they are in Russian.
const FORMAT_MESSAGE = "Введите дату как 14.03 или 14.03.1990";
const FUTURE_YEAR_MESSAGE = "Год не может быть в будущем";
const OLD_YEAR_MESSAGE = "Год не раньше 1900";

/** The earliest year that is accepted: an earlier one is most likely a typo. */
export const MIN_BIRTH_YEAR = 1900;

const INPUT_PATTERN = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/;

export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in the month; February has 29, because a birthday may be on February 29. */
function maxDayOfMonth(month: number, year: number | null) {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Reads `ДД.ММ` or `ДД.ММ.ГГГГ` (a day and a month may have one digit). An empty value
 * means "no birthday". "Today" for the check of the year is the current date.
 */
export function parseBirthday(text: string): ParsedBirthday {
  const value = text.trim();
  if (value === "") {
    return { ok: true, birthday: null };
  }

  const match = INPUT_PATTERN.exec(value);
  if (!match) {
    return { ok: false, message: FORMAT_MESSAGE };
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] === undefined ? null : Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > maxDayOfMonth(month, year)) {
    return { ok: false, message: FORMAT_MESSAGE };
  }
  if (year !== null) {
    if (year < MIN_BIRTH_YEAR) return { ok: false, message: OLD_YEAR_MESSAGE };
    if (year > new Date().getFullYear()) return { ok: false, message: FUTURE_YEAR_MESSAGE };
  }
  return { ok: true, birthday: { day, month, year } };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The text for the form field: `05.03.1990`, `14.03`, or "" when there is no birthday. */
export function formatBirthdayInput(birthday: Birthday | null) {
  if (!birthday) return "";
  const dayAndMonth = `${pad(birthday.day)}.${pad(birthday.month)}`;
  return birthday.year === null ? dayAndMonth : `${dayAndMonth}.${birthday.year}`;
}

/** How many days after today a birthday still counts as "soon": today and the 7 days after it. */
export const BIRTHDAY_WINDOW_DAYS = 7;

export type WindowDay = {
  /** Local midnight of the day. */
  date: Date;
  day: number;
  month: number;
  daysAhead: number;
};

/** The days in which a birthday counts as "soon": today and the days after it, in a row. */
export function birthdayWindow(today: Date): WindowDay[] {
  return Array.from({ length: BIRTHDAY_WINDOW_DAYS + 1 }, (_, daysAhead) => {
    // The Date constructor carries days over to the next month and year.
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead);
    return { date, day: date.getDate(), month: date.getMonth() + 1, daysAhead };
  });
}

export type BirthdayMatch = {
  /** The day of this birthday: February 28 for a birthday on February 29 in a common year. */
  date: Date;
  daysAhead: number;
  /** The age the person turns; null when the year of birth is not known. */
  age: number | null;
};

/** Finds the birthday in the window; null when it does not fall into it. */
export function matchWindow(birthday: Birthday, window: WindowDay[]): BirthdayMatch | null {
  const found = window.find(
    ({ date, day, month }) =>
      (month === birthday.month && day === birthday.day) ||
      // No February 29 in a common year: the birthday is on February 28.
      (birthday.month === 2 &&
        birthday.day === 29 &&
        month === 2 &&
        day === 28 &&
        !isLeapYear(date.getFullYear())),
  );
  if (!found) return null;

  return {
    date: found.date,
    daysAhead: found.daysAhead,
    age: birthday.year === null ? null : found.date.getFullYear() - birthday.year,
  };
}

const dayAndMonthFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/** "14 марта 1990 г." or, when the year is not known, "14 марта". */
export function formatBirthdayLong({ day, month, year }: Birthday) {
  // Without a year, a leap year keeps February 29 a valid date.
  return year === null
    ? dayAndMonthFormat.format(new Date(2000, month - 1, day))
    : formatDate(new Date(year, month - 1, day));
}

const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];

/** E.g. "сегодня · 22 ноября · исполняется 36" or "через 3 дня · 25 ноября". */
export function birthdayRowDetails({ daysAhead, date, age }: BirthdayMatch) {
  const when =
    daysAhead === 0
      ? "сегодня"
      : daysAhead === 1
        ? "завтра"
        : `через ${pluralize(daysAhead, DAY_FORMS)}`;
  const parts = [when, dayAndMonthFormat.format(date)];
  if (age !== null) parts.push(`исполняется ${age}`);
  return parts.join(" · ");
}
