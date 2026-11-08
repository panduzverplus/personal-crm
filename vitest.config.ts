import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { getTestDatabaseUrl } from "./src/test/test-database-url";

// Load .env the same way Next.js does, so tests find the database settings.
loadEnvConfig(process.cwd());

const src = path.resolve(import.meta.dirname, "src");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.join(src, "test/stubs/server-only.ts") },
      { find: /^next\/server$/, replacement: path.join(src, "test/stubs/next-server.ts") },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    // DATABASE_URL wins over POSTGRES_* in src/db/config.ts, so the app code under test
    // connects to the test database and never to the working one.
    env: { DATABASE_URL: getTestDatabaseUrl() },
    // All database tests share one database, so test files run one after another.
    fileParallelism: false,
  },
});
