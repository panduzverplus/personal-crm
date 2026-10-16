import "server-only";
import type postgres from "postgres";
import { createDb, createPostgresClient } from "./client";

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { postgresClient?: postgres.Sql };

const client = globalForDb.postgresClient ?? createPostgresClient();
if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = createDb(client);
