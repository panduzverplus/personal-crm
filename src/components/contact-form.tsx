"use client";

import Link from "next/link";
import { useActionState } from "react";
import { GroupPicker, type CreateGroupAction } from "@/components/group-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ContactField, ContactFormState } from "@/lib/contact-form";
import type { GroupRef } from "@/lib/group-form";
import { contactFrequencies, frequencyTitle } from "@/lib/keep-in-touch";

type FieldConfig = {
  name: ContactField;
  label: string;
  placeholder?: string;
  type?: "text" | "tel" | "email";
  inputMode?: "numeric";
  // A line under the field that tells how to fill it in.
  hint?: string;
  multiline?: boolean;
  // Makes the field a dropdown with these options.
  options?: { value: string; label: string }[];
  required?: boolean;
};

const FREQUENCY_OPTIONS = [
  { value: "", label: "Не задано" },
  ...contactFrequencies.map((frequency) => ({
    value: frequency,
    label: frequencyTitle(frequency),
  })),
];

const FIELDS: FieldConfig[] = [
  { name: "name", label: "Имя", placeholder: "Например, Анна Смирнова", required: true },
  { name: "about", label: "Кто это", placeholder: "Например, дизайнер, подруга Саши" },
  {
    name: "howWeMet",
    label: "Откуда знакомы",
    placeholder: "Например, учились вместе в университете",
    multiline: true,
  },
  { name: "phone", label: "Телефон", placeholder: "+7 900 000-00-00", type: "tel" },
  { name: "email", label: "Почта", placeholder: "name@example.com", type: "email" },
  {
    name: "birthday",
    label: "День рождения",
    placeholder: "14.03.1990",
    inputMode: "numeric",
    hint: "Например, 14.03 или 14.03.1990: год можно не указывать",
  },
  { name: "contactFrequency", label: "Как часто общаться", options: FREQUENCY_OPTIONS },
];

/** The ids of the hint and the error under a field, for `aria-describedby`. */
function describedBy(id: string, error: string | undefined, hint: string | undefined) {
  const ids = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Used both to add a new contact and to edit an existing one. */
export function ContactForm({
  action,
  initialState,
  groups,
  createGroupAction,
  submitLabel,
  cancelHref,
}: {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  initialState: ContactFormState;
  groups: GroupRef[];
  createGroupAction: CreateGroupAction;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {FIELDS.map((field) => {
        const id = `contact-${field.name}`;
        const error = state.errors[field.name];
        const commonProps = {
          id,
          name: field.name,
          defaultValue: state.values[field.name],
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy(id, error, field.hint),
        };
        return (
          <div key={field.name} className="flex flex-col gap-2">
            <Label htmlFor={id}>
              {field.label}
              {field.required ? (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">— необязательно</span>
              )}
            </Label>
            {field.options ? (
              // React applies a select's defaultValue only on mount, and the form is reset
              // after a failed save: remount with the submitted value so the choice is kept.
              <NativeSelect key={commonProps.defaultValue} {...commonProps}>
                {field.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : field.multiline ? (
              <Textarea {...commonProps} placeholder={field.placeholder} rows={2} />
            ) : (
              <Input
                {...commonProps}
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                inputMode={field.inputMode}
                required={field.required}
                autoFocus={field.name === "name"}
                autoComplete="off"
              />
            )}
            {field.hint && (
              <p id={`${id}-hint`} className="text-sm text-muted-foreground">
                {field.hint}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <GroupPicker
        groups={groups}
        initialSelected={initialState.groupIds}
        createAction={createGroupAction}
      />

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Отмена
        </Link>
      </div>
    </form>
  );
}
