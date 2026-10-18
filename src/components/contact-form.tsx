"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ContactField, ContactFormState } from "@/lib/contact-form";

type FieldConfig = {
  name: ContactField;
  label: string;
  placeholder: string;
  type?: "text" | "tel" | "email";
  multiline?: boolean;
  required?: boolean;
};

const FIELDS: FieldConfig[] = [
  { name: "name", label: "Имя", placeholder: "Например, Анна Смирнова", required: true },
  { name: "about", label: "Кто это", placeholder: "Например, дизайнер, подруга Саши" },
  { name: "howWeMet", label: "Откуда знакомы", placeholder: "Например, учились вместе в университете", multiline: true },
  { name: "phone", label: "Телефон", placeholder: "+7 900 000-00-00", type: "tel" },
  { name: "email", label: "Почта", placeholder: "name@example.com", type: "email" },
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
          placeholder: field.placeholder,
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
            {field.multiline ? (
              <Textarea {...commonProps} rows={2} />
            ) : (
              <Input
                {...commonProps}
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
