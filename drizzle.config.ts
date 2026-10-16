import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { getDatabaseCredentials } from "./src/db/config";

// Load .env the same way Next.js does, so the app and drizzle-kit share settings.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: getDatabaseCredentials(),
  strict: true,
  verbose: true,
});
