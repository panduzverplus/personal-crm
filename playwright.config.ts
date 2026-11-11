import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { TEST_OWNER_EMAIL } from "./src/test/migrated-database";
import { getE2eDatabaseUrl } from "./src/test/test-database-url";

// Load .env the same way Next.js does, so tests find the database settings.
loadEnvConfig(process.cwd());

// Not 3000: the tests start their own server and must never talk to a running `pnpm dev`,
// which is connected to the working database.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Tests share one database, so they run one after another.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The database comes first: the server is considered up once /health reaches it.
    command: `pnpm exec tsx e2e/prepare-database.ts && pnpm build && pnpm exec next start -H 127.0.0.1 -p ${PORT}`,
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      // DATABASE_URL wins over POSTGRES_* in src/db/config.ts, so the app never sees the working database.
      DATABASE_URL: getE2eDatabaseUrl(),
      // Login: the letters go to Mailpit (compose.yaml, `pnpm db:up`), the links lead back to this server.
      // Fixed values, so the tests do not depend on the login settings in .env.
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-secret-that-is-long-enough-for-better-auth",
      SMTP_URL: "smtp://127.0.0.1:1025",
      OWNER_EMAIL: TEST_OWNER_EMAIL,
    },
  },
});
