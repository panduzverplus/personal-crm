const pluralRules = new Intl.PluralRules("ru-RU");

/** Picks the Russian plural form: forms are for 1, 2–4 and 5+ (e.g. контакт/контакта/контактов). */
export function pluralize(
  count: number,
  [one, few, many]: [string, string, string],
) {
  const form = pluralRules.select(count);
  const word = form === "one" ? one : form === "few" ? few : many;
  return `${count.toLocaleString("ru-RU")} ${word}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatDateTime = (date: Date) => dateTimeFormat.format(date);
export const formatDate = (date: Date) => dateFormat.format(date);

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
