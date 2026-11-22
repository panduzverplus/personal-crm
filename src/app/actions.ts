"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  contactFields,
  contactSchema,
  noteSchema,
  parseGroupIds,
  type AddNoteState,
  type ContactFormState,
  type ContactFormValues,
  type DeleteContactState,
  type EditNoteState,
} from "@/lib/contact-form";
import {
  deleteContactById,
  insertContact,
  insertNote,
  updateContactById,
  updateNoteBody,
} from "@/lib/contacts";
import {
  parseGroupName,
  type CreateGroupState,
  type DeleteGroupState,
  type RenameGroupState,
} from "@/lib/group-form";
import { deleteGroupById, insertGroup, renameGroupById } from "@/lib/groups";
import { parseListParams, pathWithListParams, type ListParams } from "@/lib/list-params";
import { logError } from "@/lib/log-error";
import { requireUser } from "@/lib/session";

function readContactForm(formData: FormData) {
  const values = Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ContactFormValues;

  const groupIds = parseGroupIds(formData.getAll("groupIds"));

  const parsed = contactSchema.safeParse(values);
  if (parsed.success) {
    return { values, groupIds, data: parsed.data, errors: null };
  }

  const fieldErrors = z.flattenError(parsed.error).fieldErrors;
  const errors: ContactFormState["errors"] = {};
  for (const field of contactFields) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }
  return { values, groupIds, data: null, errors };
}

export async function createContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const form = readContactForm(formData);
  if (form.errors) {
    return {
      values: form.values,
      groupIds: form.groupIds,
      errors: form.errors,
    };
  }

  let id: number;
  try {
    id = await insertContact(user.id, form.data, form.groupIds);
  } catch (error) {
    logError("Failed to create contact", error);
    return {
      values: form.values,
      groupIds: form.groupIds,
      errors: {},
      formError: "Не удалось сохранить контакт. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/");
  redirect(`/?added=${id}`);
}

// Action arguments come from the browser, so the list parameters are checked like any other input.
function readListParams(raw: ListParams) {
  return parseListParams({
    group: String(raw?.group ?? ""),
    q: String(raw?.q ?? ""),
  });
}

export async function updateContact(
  contactId: number,
  listParams: ListParams,
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const user = await requireUser();
  const form = readContactForm(formData);
  if (form.errors) {
    return {
      values: form.values,
      groupIds: form.groupIds,
      errors: form.errors,
    };
  }

  let updated = false;
  if (Number.isInteger(contactId) && contactId > 0) {
    try {
      updated = await updateContactById(user.id, contactId, form.data, form.groupIds);
    } catch (error) {
      logError("Failed to update contact", error);
      return {
        values: form.values,
        groupIds: form.groupIds,
        errors: {},
        formError: "Не удалось сохранить изменения. Попробуйте ещё раз.",
      };
    }
  }
  if (!updated) {
    return {
      values: form.values,
      groupIds: form.groupIds,
      errors: {},
      formError: "Контакт не найден",
    };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // The card opens with the same list behind it: its group and search are kept.
  redirect(
    pathWithListParams(`/contacts/${contactId}`, readListParams(listParams), {
      updated: "1",
    }),
  );
}

export async function deleteContact(
  contactId: number,
  listParams: ListParams,
): Promise<DeleteContactState> {
  const user = await requireUser();
  let name: string | null = null;
  if (Number.isInteger(contactId) && contactId > 0) {
    try {
      name = await deleteContactById(user.id, contactId);
    } catch (error) {
      logError("Failed to delete contact", error);
      return { error: "Не удалось удалить контакт. Попробуйте ещё раз." };
    }
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // Already deleted (e.g. in another tab): the contact is gone either way, so no message.
  // The same list opens again, with its group and search.
  const list = readListParams(listParams);
  // The message has no name: the address goes to the server log, so it must not carry personal data.
  redirect(pathWithListParams("/", list, name === null ? {} : { deleted: "1" }));
}

export async function addNote(
  contactId: number,
  _previous: AddNoteState,
  formData: FormData,
): Promise<AddNoteState> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "");

  if (!Number.isInteger(contactId) || contactId <= 0) {
    return { status: "error", body, error: "Контакт не найден" };
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "error", body, error: parsed.error.issues[0].message };
  }

  try {
    const saved = await insertNote(user.id, contactId, parsed.data);
    if (!saved) {
      return { status: "error", body, error: "Контакт не найден" };
    }
  } catch (error) {
    logError("Failed to add note", error);
    return {
      status: "error",
      body,
      error: "Не удалось сохранить заметку. Попробуйте ещё раз.",
    };
  }

  // A new note restarts the keep-in-touch due day, so the home page block changes too.
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return { status: "saved", body: "", savedAt: Date.now() };
}

export async function updateNote(
  noteId: number,
  _previous: EditNoteState,
  formData: FormData,
): Promise<EditNoteState> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "");

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "error", body, error: parsed.error.issues[0].message };
  }

  let contactId: number | null = null;
  if (Number.isInteger(noteId) && noteId > 0) {
    try {
      contactId = await updateNoteBody(user.id, noteId, parsed.data);
    } catch (error) {
      logError("Failed to update note", error);
      return {
        status: "error",
        body,
        error: "Не удалось сохранить заметку. Попробуйте ещё раз.",
      };
    }
  }
  if (contactId === null) {
    return { status: "error", body, error: "Заметка не найдена" };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { status: "saved" };
}

// A group name is shown on the home page, in the contact forms and in every contact card,
// so any change to groups refreshes the whole app.
function revalidateGroups() {
  revalidatePath("/", "layout");
}

export async function createGroup(
  _previous: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");

  const parsed = parseGroupName(name);
  if (!parsed.ok) {
    return { status: "error", name, error: parsed.error };
  }

  let result;
  try {
    result = await insertGroup(user.id, parsed.name);
  } catch (error) {
    logError("Failed to create group", error);
    return {
      status: "error",
      name,
      error: "Не удалось создать группу. Попробуйте ещё раз.",
    };
  }
  if (result.status === "duplicate") {
    return { status: "error", name, error: "Такая группа уже есть" };
  }

  revalidateGroups();
  return { status: "saved", group: result.group, savedAt: Date.now() };
}

export async function renameGroup(
  groupId: number,
  _previous: RenameGroupState,
  formData: FormData,
): Promise<RenameGroupState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");

  const parsed = parseGroupName(name);
  if (!parsed.ok) {
    return { status: "error", name, error: parsed.error };
  }

  let result: Awaited<ReturnType<typeof renameGroupById>> = {
    status: "not-found",
  };
  if (Number.isInteger(groupId) && groupId > 0) {
    try {
      result = await renameGroupById(user.id, groupId, parsed.name);
    } catch (error) {
      logError("Failed to rename group", error);
      return {
        status: "error",
        name,
        error: "Не удалось сохранить название. Попробуйте ещё раз.",
      };
    }
  }
  if (result.status === "duplicate") {
    return { status: "error", name, error: "Такая группа уже есть" };
  }
  if (result.status === "not-found") {
    return { status: "error", name, error: "Группа не найдена" };
  }

  revalidateGroups();
  return { status: "saved" };
}

export async function deleteGroup(groupId: number): Promise<DeleteGroupState> {
  const user = await requireUser();
  if (Number.isInteger(groupId) && groupId > 0) {
    try {
      await deleteGroupById(user.id, groupId);
    } catch (error) {
      logError("Failed to delete group", error);
      return { error: "Не удалось удалить группу. Попробуйте ещё раз." };
    }
  }

  // Already deleted (e.g. in another tab): the group is gone either way, so there is nothing to report.
  revalidateGroups();
  return {};
}
