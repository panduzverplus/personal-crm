const UNIQUE_VIOLATION = "23505";

/** Drizzle wraps the driver error, so the Postgres error code sits on `cause`. */
export function isUniqueViolation(error: unknown) {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  const code = cause?.code ?? (error as { code?: unknown } | null)?.code;
  return code === UNIQUE_VIOLATION;
}
