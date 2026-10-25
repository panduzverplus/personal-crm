import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const contactFrequency = pgEnum("contact_frequency", [
  "week",
  "month",
  "quarter",
  "year",
]);

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // Who the person is: role, occupation, relation.
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  // How often to keep in touch; null when not set.
  contactFrequency: contactFrequency("contact_frequency"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Null until the note text is edited for the first time.
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("notes_contact_id_created_at_idx").on(
      table.contactId,
      table.createdAt,
    ),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
