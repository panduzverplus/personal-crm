import { z } from "zod";

// No server-only imports: client components use the schema and the state types.
// Validation messages are shown in the UI, so they are in Russian.

export const GROUP_NAME_MAX_LENGTH = 50;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(GROUP_NAME_MAX_LENGTH, "Название не длиннее 50 символов");

export type GroupNameResult = { ok: true; name: string } | { ok: false; error: string };

/** Checks a group name taken from a form; a missing or non-text value counts as empty. */
export function parseGroupName(value: unknown): GroupNameResult {
  const result = groupNameSchema.safeParse(typeof value === "string" ? value : "");
  return result.success
    ? { ok: true, name: result.data }
    : { ok: false, error: result.error.issues[0].message };
}

export type GroupRef = { id: number; name: string };

/** Creating a group, on the groups page and in the contact form. */
export type CreateGroupState =
  | { status: "idle" }
  | { status: "saved"; group: GroupRef; savedAt: number }
  | { status: "error"; name: string; error: string };

export const initialCreateGroupState: CreateGroupState = { status: "idle" };

/** Renaming a group in its row. */
export type RenameGroupState =
  { status: "idle" } | { status: "saved" } | { status: "error"; name: string; error: string };

export type DeleteGroupState = { error?: string };
