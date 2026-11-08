"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { initialCreateGroupState, type CreateGroupState, type GroupRef } from "@/lib/group-form";

export type CreateGroupAction = (
  state: CreateGroupState,
  formData: FormData,
) => Promise<CreateGroupState>;

/**
 * The "Группы" field of the contact form: one checkbox per group, and a way to create a new group
 * without leaving the form. The checked set lives in state, so a failed save (which resets the form)
 * keeps the marks.
 */
export function GroupPicker({
  groups,
  initialSelected,
  createAction,
}: {
  groups: GroupRef[];
  initialSelected: number[];
  createAction: CreateGroupAction;
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle(id: number, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Creates the group right away, with the same action and the same checks as on the "Группы" page.
  function createGroup() {
    const formData = new FormData();
    formData.set("name", newName);
    startTransition(async () => {
      const result = await createAction(initialCreateGroupState, formData);
      if (result.status === "saved") {
        toggle(result.group.id, true);
        setNewName("");
        setError(undefined);
      } else if (result.status === "error") {
        setError(result.error);
      }
    });
  }

  return (
    <div role="group" aria-labelledby="contact-groups-label" className="flex flex-col gap-3">
      <span
        id="contact-groups-label"
        className="flex items-center gap-2 text-sm leading-none font-medium"
      >
        Группы
        <span className="font-normal text-muted-foreground">— необязательно</span>
      </span>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Групп пока нет.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="flex min-h-10 max-w-full cursor-pointer items-center gap-2.5 rounded-full border border-border px-4 py-1.5 text-sm select-none has-data-checked:bg-muted"
            >
              <Checkbox
                // An explicit id: the generated one differs between the server HTML and the browser.
                id={`contact-group-${group.id}`}
                checked={selected.has(group.id)}
                onCheckedChange={(checked) => toggle(group.id, checked)}
              />
              <span className="min-w-0 break-words">{group.name}</span>
            </label>
          ))}
        </div>
      )}

      {/*
        The checkboxes send nothing themselves: a failed save resets the form, which would
        uncheck their hidden inputs while the screen still shows the marks. A hidden input
        keeps its value through a reset.
      */}
      {groups
        .filter((group) => selected.has(group.id))
        .map((group) => (
          <input key={group.id} type="hidden" name="groupIds" value={group.id} />
        ))}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {/* No `name`: the typed text is not sent with the contact. */}
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              // Enter creates the group; it must not save the whole contact.
              if (event.key === "Enter") {
                event.preventDefault();
                if (!pending) createGroup();
              }
            }}
            placeholder="Новая группа"
            aria-label="Новая группа"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-contact-group-error" : undefined}
            className="flex-1 basis-48"
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={createGroup}
          >
            {pending ? "Создаю…" : "Создать"}
          </Button>
        </div>
        {error && (
          <p id="new-contact-group-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
