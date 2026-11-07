"use client";

import { useActionState, useState } from "react";
import { DeleteGroupButton } from "@/components/delete-group-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pluralize } from "@/lib/format";
import type { DeleteGroupState, RenameGroupState } from "@/lib/group-form";

type RenameGroupAction = (
  state: RenameGroupState,
  formData: FormData,
) => Promise<RenameGroupState>;

/** One group on the "Группы" page: name, contact count, and the rename and delete buttons. */
export function GroupRow({
  groupId,
  name,
  contactCount,
  renameAction,
  deleteAction,
}: {
  groupId: number;
  name: string;
  contactCount: number;
  renameAction: RenameGroupAction;
  deleteAction: () => Promise<DeleteGroupState>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="border-t py-3 last:border-b md:py-4">
      {editing ? (
        // Mounted only while editing, so every edit starts from the saved name.
        <GroupNameEditor
          groupId={groupId}
          name={name}
          action={renameAction}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 basis-40 break-words">{name}</p>
          <p className="font-mono text-meta text-muted-foreground uppercase">
            {pluralize(contactCount, ["контакт", "контакта", "контактов"])}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              aria-label={`Изменить группу «${name}»`}
              onClick={() => setEditing(true)}
            >
              Изменить
            </Button>
            <DeleteGroupButton
              groupName={name}
              contactCount={contactCount}
              action={deleteAction}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function GroupNameEditor({
  groupId,
  name,
  action,
  onClose,
}: {
  groupId: number;
  name: string;
  action: RenameGroupAction;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    RenameGroupState,
    FormData
  >(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "saved") onClose();
      return result;
    },
    { status: "idle" },
  );

  const inputId = `group-${groupId}-name`;
  const errorId = `${inputId}-error`;
  const error = state.status === "error" ? state.error : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <Label htmlFor={inputId} className="sr-only">
        Название группы
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          name="name"
          defaultValue={state.status === "error" ? state.name : name}
          autoFocus
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="flex-1 basis-48"
          onFocus={(event) => {
            // Put the cursor at the end of the name, ready to edit it.
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              onClose();
            }
          }}
        />
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
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
