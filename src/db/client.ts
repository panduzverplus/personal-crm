import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseCredentials } from "./config";
import * as schema from "./schema";

type ClientOptions = {
  max?: number;
  onnotice?: (notice: postgres.Notice) => void;
};

export function createPostgresClient(options: ClientOptions = {}) {
  const credentials = getDatabaseCredentials();
  if ("url" in credentials) {
    return postgres(credentials.url, options);
  }
  return postgres({
    host: credentials.host,
    port: credentials.port,
    username: credentials.user,
    password: credentials.password,
    database: credentials.database,
    ssl: credentials.ssl,
    ...options,
  });
}

export function createDb(client: postgres.Sql) {
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
