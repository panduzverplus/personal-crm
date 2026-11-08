"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import type { DeleteGroupState } from "@/lib/group-form";

const pluralRules = new Intl.PluralRules("ru-RU");

/** "Удалить" button in a group row; asks for confirmation first. */
export function DeleteGroupButton({
  groupName,
  contactCount,
  action,
}: {
  groupName: string;
  contactCount: number;
  action: () => Promise<DeleteGroupState>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // "1 контакт останется", but "2 контакта останутся".
  const single = pluralRules.select(contactCount) === "one";
  const contacts = pluralize(contactCount, ["контакт", "контакта", "контактов"]);

  function handleDelete() {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
      // On success the page is refreshed without this group, which closes the dialog with the row.
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Keep the dialog open until the deletion finishes.
        if (pending) return;
        setOpen(next);
        setError(undefined);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="xs" aria-label={`Удалить группу «${groupName}»`} />
        }
      >
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Удалить группу «{groupName}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {contactCount === 0
              ? "В группе нет контактов. Отменить это нельзя."
              : `${contacts} ${single ? "останется" : "останутся"} в списке, но ${single ? "выйдет" : "выйдут"} из группы. Отменить это нельзя.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
