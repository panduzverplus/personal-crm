// Parameters of the contact list that live in the page address: `/?group=3&q=анна`.
// No server-only imports: pages, client components and server actions all use this file.

export type ListParams = {
  /** Selected group id; null means "all contacts". */
  group: number | null;
  /** Search query, trimmed; empty when there is no search. */
  q: string;
};

type SearchParamValue = string | string[] | undefined;

// Group ids are Postgres `integer`.
const MAX_GROUP_ID = 2_147_483_647;

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

/** Turns text into a group id, or null when it is not a valid id. */
export function parseGroupId(value: unknown) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return id <= MAX_GROUP_ID ? id : null;
}

/** Reads `group` and `q` from page search params; anything invalid counts as not set. */
export function parseListParams(
  searchParams: Record<string, SearchParamValue>,
): ListParams {
  return {
    group: parseGroupId(firstValue(searchParams.group)),
    q: (firstValue(searchParams.q) ?? "").trim(),
  };
}

/** Builds the query string for the list address: "" when nothing is set, otherwise starts with "?". */
export function listQueryString({ group, q }: ListParams) {
  const query = new URLSearchParams();
  if (group !== null) {
    query.set("group", String(group));
  }
  if (q) {
    query.set("q", q);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/**
 * Adds the list parameters to a path, so a page can lead back to the same list:
 * `/contacts/5?group=3&q=анна`. Extra parameters go after them.
 */
export function pathWithListParams(
  path: string,
  { group, q }: ListParams,
  extra: Record<string, string> = {},
) {
  const query = new URLSearchParams();
  if (group !== null) {
    query.set("group", String(group));
  }
  if (q) {
    query.set("q", q);
  }
  for (const [key, value] of Object.entries(extra)) {
    query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** True when a group or a search narrows the list. */
export function isListNarrowed({ group, q }: ListParams) {
  return group !== null || q !== "";
}
