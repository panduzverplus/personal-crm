import { loadEnvConfig } from "@next/env";
import { createDb, createPostgresClient } from "./client";
import { createRandom } from "./seed-data";
import { seedDemoData } from "./seed-demo";

const CONTACT_COUNT = 1000;
const RANDOM_SEED = 20261012;

// Fills the contacts of the owner (OWNER_EMAIL) with test data, only if the owner has none.
async function main() {
  loadEnvConfig(process.cwd());

  const client = createPostgresClient({ max: 1, onnotice: () => {} });
  try {
    const result = await seedDemoData(createDb(client), process.env.OWNER_EMAIL, {
      total: CONTACT_COUNT,
      random: createRandom(RANDOM_SEED),
      now: new Date(),
    });

    if (result.status === "skipped") {
      // Never touch existing data: seeding is only for an owner without contacts.
      console.log("The owner already has contacts, seeding skipped.");
      return;
    }
    console.log(`Seeded ${result.contacts} contacts and ${result.notes} notes for the owner.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
