import { loadEnvConfig } from "@next/env";
import { count } from "drizzle-orm";
import { createDb, createPostgresClient } from "./client";
import { contacts, notes } from "./schema";
import { createRandom, generateContacts } from "./seed-data";

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 200;
const RANDOM_SEED = 20261012;

async function main() {
  loadEnvConfig(process.cwd());

  const client = createPostgresClient({ max: 1, onnotice: () => {} });
  const db = createDb(client);

  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts);
    if (existing > 0) {
      // Never touch existing data: seeding is only for an empty database.
      console.log(
        `Database already contains ${existing} contacts, seeding skipped.`,
      );
      return;
    }

    const generated = generateContacts(
      CONTACT_COUNT,
      createRandom(RANDOM_SEED),
      new Date(),
    );

    let noteTotal = 0;
    await db.transaction(async (tx) => {
      for (let start = 0; start < generated.length; start += BATCH_SIZE) {
        const batch = generated.slice(start, start + BATCH_SIZE);
        const inserted = await tx
          .insert(contacts)
          .values(
            batch.map(({ name, about, howWeMet, phone, email, createdAt }) => ({
              name,
              about,
              howWeMet,
              phone,
              email,
              createdAt,
            })),
          )
          .returning({ id: contacts.id, name: contacts.name });

        // Names are unique within generated data, so they map rows back to ids.
        const idByName = new Map(inserted.map((row) => [row.name, row.id]));
        const noteRows = batch.flatMap((contact) =>
          contact.notes.map((note) => ({
            contactId: idByName.get(contact.name)!,
            body: note.body,
            createdAt: note.createdAt,
          })),
        );
        if (noteRows.length > 0) {
          await tx.insert(notes).values(noteRows);
        }
        noteTotal += noteRows.length;
      }
    });

    console.log(
      `Seeded ${generated.length} contacts and ${noteTotal} notes.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
