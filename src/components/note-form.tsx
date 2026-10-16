"use client";

import { CircleCheckIcon } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialAddNoteState, type AddNoteState } from "@/lib/contact-form";

export function NoteForm({
  action,
}: {
  action: (state: AddNoteState, formData: FormData) => Promise<AddNoteState>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAddNoteState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="note-body" className="sr-only">
        Новая заметка
      </Label>
      <Textarea
        id="note-body"
        name="body"
        defaultValue={state.body}
        rows={3}
        placeholder="О чём поговорили, о чём договорились…"
        aria-invalid={state.status === "error" ? true : undefined}
        aria-describedby={state.status === "error" ? "note-body-error" : undefined}
        className="bg-background"
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
        {state.status === "error" && (
          <p id="note-body-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {state.status === "saved" && !pending && (
          <p
            key={state.savedAt}
            role="status"
            className="flex items-center gap-1.5 text-sm text-emerald-700"
          >
            <CircleCheckIcon aria-hidden className="size-4" />
            Заметка сохранена
          </p>
        )}
        {state.status === "idle" && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            Ctrl + Enter — сохранить
          </p>
        )}
      </div>
    </form>
  );
}
