// Postgres error fields that say what failed without quoting any stored value.
const POSTGRES_FIELDS = ["code", "table_name", "column_name", "constraint_name"] as const;

// The class name, not `error.name`: Drizzle's errors do not set `name`, so it would be just "Error".
function errorName(error: unknown) {
  return error instanceof Error ? error.constructor.name : typeof error;
}

function readField(error: unknown, field: string) {
  const value = (error as Record<string, unknown> | null | undefined)?.[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Describes an error without any user data. The message, the query parameters and the `detail`
 * of a database error hold what the user typed (names, phones, emails, notes), so none of them
 * are read. Only the error type and the Postgres code, table, column and constraint are kept.
 */
export function describeError(error: unknown) {
  const parts = [errorName(error)];
  // Drizzle wraps the driver error, so the Postgres fields sit on `cause`.
  const source = (error as { cause?: unknown } | null | undefined)?.cause ?? error;
  const cause = source === error ? [] : [errorName(source)];
  const fields = POSTGRES_FIELDS.flatMap((field) => {
    const value = readField(source, field) ?? readField(error, field);
    return value === undefined ? [] : [`${field}=${value}`];
  });
  return [...parts, ...cause, ...fields].join(" ");
}

/** Logs a failure for the server log. Use it instead of `console.error(message, error)`. */
export function logError(message: string, error: unknown) {
  console.error(`${message}: ${describeError(error)}`);
}
