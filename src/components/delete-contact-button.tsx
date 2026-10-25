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
import type { DeleteContactState } from "@/lib/contact-form";

/** "Delete" button in the contact card; asks for confirmation first. */
export function DeleteContactButton({
  contactName,
  action,
}: {
  contactName: string;
  action: () => Promise<DeleteContactState>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      // On success the action redirects to the list, so only an error comes back.
      const result = await action();
      setError(result.error);
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
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            Удалить контакт «{contactName}»?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Заметки контакта тоже удалятся. Отменить это нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
