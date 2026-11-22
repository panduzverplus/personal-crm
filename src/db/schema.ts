import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

export * from "./auth-schema";

export const contactFrequency = pgEnum("contact_frequency", ["week", "month", "quarter", "year"]);

// No cascade from users: the app never deletes users, and losing data by accident is worse than an error.
export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Whose contact it is. Notes and group links belong to a user through their contact.
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    // Who the person is: role, occupation, relation.
    about: text("about"),
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // How often to keep in touch; null when not set.
    contactFrequency: contactFrequency("contact_frequency"),
    // Birthday: the day and the month go together, the year is optional (people often do not know it).
    birthDay: smallint("birth_day"),
    birthMonth: smallint("birth_month"),
    birthYear: smallint("birth_year"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contacts_owner_id_idx").on(table.ownerId),
    // The form checks the date too; these keep a wrong one out of the database whatever writes to it.
    check(
      "contacts_birth_day_month_together",
      sql`(${table.birthDay} is null) = (${table.birthMonth} is null)`,
    ),
    check("contacts_birth_month_range", sql`${table.birthMonth} between 1 and 12`),
    check(
      "contacts_birth_day_range",
      // February has up to 29 days: the year may be unknown, so a birthday can be on February 29.
      sql`${table.birthDay} between 1 and (case when ${table.birthMonth} = 2 then 29 when ${table.birthMonth} in (4, 6, 9, 11) then 30 else 31 end)`,
    ),
    check(
      "contacts_birth_year_needs_date",
      sql`${table.birthYear} is null or (${table.birthDay} is not null and ${table.birthYear} >= 1900)`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Null until the note text is edited for the first time.
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [index("notes_contact_id_created_at_idx").on(table.contactId, table.createdAt)],
);

export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Names are unique within one owner, ignoring letter case and "е"/"ё",
    // the same rule as the contact search. Different users may have the same group name.
    uniqueIndex("groups_owner_name_normalized_idx").on(
      table.ownerId,
      sql`replace(lower(${table.name}), 'ё', 'е')`,
    ),
  ],
);

export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    // Starts with contact_id, so it also serves "groups of one contact".
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

// One row per login email sent. Counted to limit emails per address (see src/lib/auth.ts).
export const loginEmailSends = pgTable(
  "login_email_sends",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Normalized: trimmed and lowercase.
    email: text("email").notNull(),
    // The `identifier` in `verifications` of the link that this letter carried: when the next
    // letter goes to the same address, this link is cancelled.
    linkIdentifier: text("link_identifier").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_email_sends_email_sent_at_idx").on(table.email, table.sentAt)],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
