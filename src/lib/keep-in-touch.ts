import type { Contact } from "@/db/schema";

// No runtime imports: the contact form (a client component) uses the labels too.

export type ContactFrequency = NonNullable<Contact["contactFrequency"]>;

/** UI labels: `title` starts a line, `inline` goes inside a sentence. */
const FREQUENCY_LABELS: Record<
  ContactFrequency,
  { title: string; inline: string }
> = {
  week: { title: "Раз в неделю", inline: "раз в неделю" },
  month: { title: "Раз в месяц", inline: "раз в месяц" },
  quarter: { title: "Раз в квартал", inline: "раз в квартал" },
  year: { title: "Раз в год", inline: "раз в год" },
};

/** All frequencies, from the most to the least frequent. */
export const contactFrequencies = Object.keys(
  FREQUENCY_LABELS,
) as ContactFrequency[];

export const frequencyTitle = (frequency: ContactFrequency) =>
  FREQUENCY_LABELS[frequency].title;

export const frequencyInline = (frequency: ContactFrequency) =>
  FREQUENCY_LABELS[frequency].inline;

const PERIOD_MONTHS: Record<Exclude<ContactFrequency, "week">, number> = {
  month: 1,
  quarter: 3,
  year: 12,
};

/**
 * The day by which to get in touch: the reference day plus the period, in local time.
 * Months are calendar months; a missing day is clamped to the month's last day
 * (Jan 31 + a month = Feb 28 or 29). Returns local midnight of that day.
 */
export function dueDate(reference: Date, frequency: ContactFrequency) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const day = reference.getDate();

  if (frequency === "week") {
    return new Date(year, month, day + 7);
  }

  const targetMonth = month + PERIOD_MONTHS[frequency];
  // Day 0 of the next month is the last day of the target month.
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return new Date(year, targetMonth, Math.min(day, lastDay));
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Overdue once today is a later calendar day than the due day; the due day itself is not. */
export function isOverdue(due: Date, today: Date) {
  return startOfDay(today) > startOfDay(due);
}
