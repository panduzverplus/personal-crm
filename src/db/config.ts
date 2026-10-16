export type DatabaseCredentials =
  | { url: string }
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      ssl: false;
    };

/**
 * Reads connection settings from environment variables (loaded from `.env`).
 * `DATABASE_URL` wins; otherwise the same POSTGRES_* variables that
 * `compose.yaml` uses to start the database container are reused.
 */
export function getDatabaseCredentials(): DatabaseCredentials {
  const url = process.env.DATABASE_URL;
  if (url) {
    return { url };
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;
  if (!user || !password || !database) {
    throw new Error(
      "Database is not configured: set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB in .env",
    );
  }

  return {
    // compose.yaml publishes the port on 127.0.0.1 only, so avoid "localhost" resolving to IPv6.
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user,
    password,
    database,
    ssl: false,
  };
}
