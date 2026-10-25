"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ContactField, ContactFormState } from "@/lib/contact-form";
import { contactFrequencies, frequencyTitle } from "@/lib/keep-in-touch";

type FieldConfig = {
  name: ContactField;
  label: string;
  placeholder?: string;
  type?: "text" | "tel" | "email";
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
  { name: "howWeMet", label: "Откуда знакомы", placeholder: "Например, учились вместе в университете", multiline: true },
  { name: "phone", label: "Телефон", placeholder: "+7 900 000-00-00", type: "tel" },
  { name: "email", label: "Почта", placeholder: "name@example.com", type: "email" },
  { name: "contactFrequency", label: "Как часто общаться", options: FREQUENCY_OPTIONS },
];

/** Used both to add a new contact and to edit an existing one. */
export function ContactForm({
  action,
  initialState,
  submitLabel,
  cancelHref,
}: {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  initialState: ContactFormState;
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
          "aria-describedby": error ? `${id}-error` : undefined,
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
                <span className="font-normal text-muted-foreground">
                  — необязательно
                </span>
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
              <Textarea
                {...commonProps}
                placeholder={field.placeholder}
                rows={2}
              />
            ) : (
              <Input
                {...commonProps}
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                required={field.required}
                autoFocus={field.name === "name"}
                autoComplete="off"
              />
            )}
            {error && (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохраняю…" : submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
