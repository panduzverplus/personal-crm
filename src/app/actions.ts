"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  contactFields,
  contactSchema,
  noteSchema,
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

function readContactForm(formData: FormData) {
  const values = Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as ContactFormValues;

  const parsed = contactSchema.safeParse(values);
  if (parsed.success) {
    return { values, data: parsed.data, errors: null };
  }

  const fieldErrors = z.flattenError(parsed.error).fieldErrors;
  const errors: ContactFormState["errors"] = {};
  for (const field of contactFields) {
    const message = fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }
  return { values, data: null, errors };
}

export async function createContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const form = readContactForm(formData);
  if (form.errors) {
    return { values: form.values, errors: form.errors };
  }

  let id: number;
  try {
    id = await insertContact(form.data);
  } catch (error) {
    console.error("Failed to create contact", error);
    return {
      values: form.values,
      errors: {},
      formError: "Не удалось сохранить контакт. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/");
  redirect(`/?added=${id}`);
}

export async function updateContact(
  contactId: number,
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const form = readContactForm(formData);
  if (form.errors) {
    return { values: form.values, errors: form.errors };
  }

  let updated = false;
  if (Number.isInteger(contactId) && contactId > 0) {
    try {
      updated = await updateContactById(contactId, form.data);
    } catch (error) {
      console.error("Failed to update contact", error);
      return {
        values: form.values,
        errors: {},
        formError: "Не удалось сохранить изменения. Попробуйте ещё раз.",
      };
    }
  }
  if (!updated) {
    return { values: form.values, errors: {}, formError: "Контакт не найден" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}?updated=1`);
}

export async function deleteContact(
  contactId: number,
): Promise<DeleteContactState> {
  let name: string | null = null;
  if (Number.isInteger(contactId) && contactId > 0) {
    try {
      name = await deleteContactById(contactId);
    } catch (error) {
      console.error("Failed to delete contact", error);
      return { error: "Не удалось удалить контакт. Попробуйте ещё раз." };
    }
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // Already deleted (e.g. in another tab): the contact is gone either way, so no message.
  redirect(name === null ? "/" : `/?${new URLSearchParams({ deleted: name })}`);
}

export async function addNote(
  contactId: number,
  _previous: AddNoteState,
  formData: FormData,
): Promise<AddNoteState> {
  const body = String(formData.get("body") ?? "");

  if (!Number.isInteger(contactId) || contactId <= 0) {
    return { status: "error", body, error: "Контакт не найден" };
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "error", body, error: parsed.error.issues[0].message };
  }

  try {
    const saved = await insertNote(contactId, parsed.data);
    if (!saved) {
      return { status: "error", body, error: "Контакт не найден" };
    }
  } catch (error) {
    console.error("Failed to add note", error);
    return {
      status: "error",
      body,
      error: "Не удалось сохранить заметку. Попробуйте ещё раз.",
    };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { status: "saved", body: "", savedAt: Date.now() };
}

export async function updateNote(
  noteId: number,
  _previous: EditNoteState,
  formData: FormData,
): Promise<EditNoteState> {
  const body = String(formData.get("body") ?? "");

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { status: "error", body, error: parsed.error.issues[0].message };
  }

  let contactId: number | null = null;
  if (Number.isInteger(noteId) && noteId > 0) {
    try {
      contactId = await updateNoteBody(noteId, parsed.data);
    } catch (error) {
      console.error("Failed to update note", error);
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
