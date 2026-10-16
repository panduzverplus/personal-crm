"use client";

import { PencilIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EditNoteState } from "@/lib/contact-form";

type EditNoteAction = (
  state: EditNoteState,
  formData: FormData,
) => Promise<EditNoteState>;

/** One note in the contact card; can be switched into an inline editor. */
export function NoteItem({
  noteId,
  body,
  createdAt,
  createdLabel,
  updatedAt,
  updatedLabel,
  action,
}: {
  noteId: number;
  body: string;
  createdAt: string;
  createdLabel: string;
  updatedAt: string | null;
  updatedLabel: string | null;
  action: EditNoteAction;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex min-h-6 items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <time dateTime={createdAt}>{createdLabel}</time>
          {updatedAt && updatedLabel && (
            <>
              {" · "}
              <span>
                изменено <time dateTime={updatedAt}>{updatedLabel}</time>
              </span>
            </>
          )}
        </p>
        {!editing && (
          <Button
            variant="ghost"
            size="xs"
            className="-mt-1 -mr-1 shrink-0 text-muted-foreground"
            aria-label={`Изменить заметку от ${createdLabel}`}
            onClick={() => setEditing(true)}
          >
            <PencilIcon data-icon="inline-start" />
            Изменить
          </Button>
        )}
      </div>
      {editing ? (
        // Mounted only while editing, so every edit starts from the saved text.
        <NoteEditor
          noteId={noteId}
          body={body}
          action={action}
          onClose={() => setEditing(false)}
        />
      ) : (
        <p className="mt-1 break-words whitespace-pre-wrap">{body}</p>
      )}
    </li>
  );
}

function NoteEditor({
  noteId,
  body,
  action,
  onClose,
}: {
  noteId: number;
  body: string;
  action: EditNoteAction;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<EditNoteState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "saved") onClose();
      return result;
    },
    { status: "idle" },
  );

  const textareaId = `note-${noteId}-body`;
  const errorId = `${textareaId}-error`;

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3">
      <Label htmlFor={textareaId} className="sr-only">
        Текст заметки
      </Label>
      <Textarea
        id={textareaId}
        name="body"
        defaultValue={state.status === "error" ? state.body : body}
        autoFocus
        aria-invalid={state.status === "error" ? true : undefined}
        aria-describedby={state.status === "error" ? errorId : undefined}
        className="bg-background"
        onFocus={(event) => {
          // Put the cursor at the end of the text, ready to continue writing.
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          } else if (event.key === "Escape" && !pending) {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onClose}
        >
          Отмена
        </Button>
        {state.status === "error" && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
