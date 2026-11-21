import "server-only";
import type postgres from "postgres";
import { createDb, createPostgresClient, type Db } from "./client";

// The database settings are read and the connection is created on the first query, not when this
// module is loaded: `next build` loads every module of the app without any database settings.

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { postgresClient?: postgres.Sql };

let instance: Db | undefined;

function getDb() {
  if (!instance) {
    const client = globalForDb.postgresClient ?? createPostgresClient();
    if (process.env.NODE_ENV !== "production") {
      globalForDb.postgresClient = client;
    }
    instance = createDb(client);
  }
  return instance;
}

/** The app database. Looks like a plain drizzle instance; the real one is created on first use. */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    // Methods must run on the real instance: they use its internal fields. `$client` is the
    // postgres client itself, a function with its own properties (`options`): it is returned as is.
    return typeof value === "function" && property !== "$client" ? value.bind(real) : value;
  },
});
