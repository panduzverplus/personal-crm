import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { isValidEmail } from "../lib/email";
import type { Db } from "./client";
import { contacts, notes, users } from "./schema";
import { generateContacts, type Random } from "./seed-data";

// Relative imports only: src/db/seed.ts runs under tsx on the server.

const BATCH_SIZE = 200;

export type SeedResult =
  { status: "seeded"; contacts: number; notes: number } | { status: "skipped" };

/**
 * Fills the owner's contacts with generated ones, with notes. The owner is the user with
 * `ownerEmail`; if there is none yet, the user is created. Only when the owner has no contacts:
 * existing data is never touched, and contacts of other users neither stop nor change the filling.
 */
export async function seedDemoData(
  db: Db,
  ownerEmail: string | undefined,
  { total, random, now }: { total: number; random: Random; now: Date },
): Promise<SeedResult> {
  const email = ownerEmail?.trim().toLowerCase() ?? "";
  if (!isValidEmail(email)) {
    throw new Error("OWNER_EMAIL is not set or is not an email address: demo data needs an owner");
  }

  return db.transaction(async (tx) => {
    let [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!owner) {
      [owner] = await tx
        .insert(users)
        .values({ id: randomUUID(), name: "", email, emailVerified: true })
        .returning({ id: users.id });
    }

    const [{ existing }] = await tx
      .select({ existing: count() })
      .from(contacts)
      .where(eq(contacts.ownerId, owner.id));
    if (existing > 0) {
      return { status: "skipped" } as const;
    }

    const generated = generateContacts(total, random, now);
    let noteTotal = 0;
    for (let start = 0; start < generated.length; start += BATCH_SIZE) {
      const batch = generated.slice(start, start + BATCH_SIZE);
      const inserted = await tx
        .insert(contacts)
        .values(
          batch.map(({ name, about, howWeMet, phone, email, createdAt }) => ({
            ownerId: owner.id,
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

    return { status: "seeded", contacts: generated.length, notes: noteTotal } as const;
  });
}
