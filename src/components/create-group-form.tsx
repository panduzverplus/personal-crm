"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialCreateGroupState, type CreateGroupState } from "@/lib/group-form";

/** Form on the "Группы" page that creates a group. */
export function CreateGroupForm({
  action,
}: {
  action: (state: CreateGroupState, formData: FormData) => Promise<CreateGroupState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialCreateGroupState);
  const error = state.status === "error" ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <Label htmlFor="new-group-name">Новая группа</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="new-group-name"
          name="name"
          // The form is reset after every action: keep what was typed on an error, clear it after a save.
          defaultValue={state.status === "error" ? state.name : ""}
          placeholder="Например, Коллеги"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-group-name-error" : undefined}
          className="h-12 flex-1 basis-56"
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Создаю…" : "Создать"}
        </Button>
      </div>
      {error && (
        <p id="new-group-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
