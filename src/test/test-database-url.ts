import { getDatabaseCredentials } from "../db/config";

// Relative imports only: vitest.config.ts imports this file before the "@/" alias exists.

const TEST_SUFFIX = "_test";

function withTestSuffix(name: string) {
  return name.endsWith(TEST_SUFFIX) ? name : `${name}${TEST_SUFFIX}`;
}

/**
 * Connection string of the database that tests run against: the working
 * database name plus `_test`. Tests never touch the working database.
 */
export function getTestDatabaseUrl(): string {
  const credentials = getDatabaseCredentials();

  if ("url" in credentials) {
    const url = new URL(credentials.url);
    const name = decodeURIComponent(url.pathname.slice(1));
    url.pathname = `/${encodeURIComponent(withTestSuffix(name))}`;
    return url.toString();
  }

  const user = encodeURIComponent(credentials.user);
  const password = encodeURIComponent(credentials.password);
  const database = encodeURIComponent(withTestSuffix(credentials.database));
  return `postgres://${user}:${password}@${credentials.host}:${credentials.port}/${database}`;
}

/** The same server, but the `postgres` maintenance database: CREATE/DROP DATABASE run there. */
export function getMaintenanceDatabaseUrl(testDatabaseUrl: string): string {
  const url = new URL(testDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

export function getDatabaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

export function isTestDatabaseName(name: string): boolean {
  return name.endsWith(TEST_SUFFIX);
}
