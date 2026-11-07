import { z } from "zod";
import { contactFrequencies } from "@/lib/keep-in-touch";
import { parseGroupId } from "@/lib/list-params";

// Validation messages are shown in the UI, so they are in Russian.

const optionalText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, tooLongMessage)
    .transform((value) => value || null);

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(200, "Имя не длиннее 200 символов"),
  about: optionalText(500, "Не длиннее 500 символов"),
  howWeMet: optionalText(500, "Не длиннее 500 символов"),
  phone: optionalText(50, "Телефон не длиннее 50 символов"),
  email: z
    .string()
    .trim()
    .max(200, "Почта не длиннее 200 символов")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Похоже, в адресе почты ошибка",
    )
    .transform((value) => value || null),
  // An empty value is the "not set" option.
  contactFrequency: z
    .enum(["", ...contactFrequencies], "Выберите вариант из списка")
    .transform((value) => value || null),
});

export type ContactInput = z.output<typeof contactSchema>;

export const contactFields = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "contactFrequency",
] as const;

export type ContactField = (typeof contactFields)[number];
export type ContactFormValues = Record<ContactField, string>;

export type ContactFormState = {
  values: ContactFormValues;
  /** Ids of the checked groups; kept apart from the text fields. */
  groupIds: number[];
  errors: Partial<Record<ContactField, string>>;
  formError?: string;
};

export const emptyContactForm: ContactFormState = {
  values: {
    name: "",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    contactFrequency: "",
  },
  groupIds: [],
  errors: {},
};

/** Pre-fills the form with a saved contact (empty fields are stored as null) and its groups. */
export function contactFormFrom(
  contact: Record<ContactField, string | null>,
  groupIds: number[],
): ContactFormState {
  return {
    values: {
      name: contact.name ?? "",
      about: contact.about ?? "",
      howWeMet: contact.howWeMet ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      contactFrequency: contact.contactFrequency ?? "",
    },
    groupIds,
    errors: {},
  };
}

/** Group ids from the checked boxes of the form; junk and repeats are dropped. */
export function parseGroupIds(values: FormDataEntryValue[]) {
  const ids = new Set<number>();
  for (const value of values) {
    const id = parseGroupId(value);
    if (id !== null) {
      ids.add(id);
    }
  }
  return [...ids];
}

export type DeleteContactState = { error?: string };

export const noteSchema = z
  .string()
  .trim()
  .min(1, "Напишите текст заметки")
  .max(10000, "Заметка не длиннее 10 000 символов");

export type AddNoteState =
  | { status: "idle"; body: string }
  | { status: "saved"; body: string; savedAt: number }
  | { status: "error"; body: string; error: string };

export const initialAddNoteState: AddNoteState = { status: "idle", body: "" };

export type EditNoteState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; body: string; error: string };
