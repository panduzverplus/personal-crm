import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CircleCheckIcon } from "lucide-react";
import { addNote, deleteContact, updateNote } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getContactWithNotes, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Карточка контакта",
};

export default function ContactPage({
  params,
  searchParams,
}: PageProps<"/contacts/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <Suspense fallback={<ContactCardSkeleton />}>
        <ContactCard params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContactCard({
  params,
  searchParams,
}: Pick<PageProps<"/contacts/[id]">, "params" | "searchParams">) {
  const [{ id: rawId }, { updated }] = await Promise.all([
    params,
    searchParams,
  ]);
  const id = parseContactId(rawId);
  if (id === null) {
    notFound();
  }

  const data = await getContactWithNotes(id);
  if (!data) {
    notFound();
  }
  const { contact, notes } = data;

  return (
    <>
      {updated && (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Изменения сохранены</AlertTitle>
        </Alert>
      )}

      <section className="flex flex-col gap-6 rounded-card border p-5 md:gap-8 md:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <ContactAvatar
            name={contact.name}
            className="size-14 text-lg md:size-16"
          />
          <div className="min-w-0 flex-1 basis-48 self-center">
            <h1 className="text-h1 font-light break-words">{contact.name}</h1>
            {contact.about && (
              <p className="mt-2 text-muted-foreground">{contact.about}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/contacts/${contact.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Изменить
            </Link>
            <DeleteContactButton
              contactName={contact.name}
              action={deleteContact.bind(null, contact.id)}
            />
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Откуда знакомы" wide>
            {contact.howWeMet}
          </Detail>
          <Detail label="Телефон">
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="tabular-nums underline-offset-4 hover:underline"
              >
                {contact.phone}
              </a>
            )}
          </Detail>
          <Detail label="Почта">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="break-all underline-offset-4 hover:underline"
              >
                {contact.email}
              </a>
            )}
          </Detail>
        </dl>

        <p className="font-mono text-meta text-muted-foreground uppercase">
          В списке с {formatDate(contact.createdAt)}
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="notes-heading">
        {/* Section heading with a line on top, as on the landing */}
        <div className="flex items-baseline justify-between gap-4 border-t pt-3.5 md:pt-4">
          <h2 id="notes-heading" className="text-h2 font-light">
            Заметки
          </h2>
          {notes.length > 0 && (
            <span className="font-mono text-meta text-muted-foreground uppercase">
              {pluralize(notes.length, ["заметка", "заметки", "заметок"])}
            </span>
          )}
        </div>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="rounded-card border px-5 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём договорились после разговора.
          </p>
        ) : (
          <ol className="flex flex-col">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                noteId={note.id}
                body={note.body}
                createdAt={note.createdAt.toISOString()}
                createdLabel={formatDateTime(note.createdAt)}
                updatedAt={note.updatedAt?.toISOString() ?? null}
                updatedLabel={
                  note.updatedAt ? formatDateTime(note.updatedAt) : null
                }
                action={updateNote.bind(null, note.id)}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Detail({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 border-t pt-3", wide && "sm:col-span-2")}>
      <dt className="font-mono text-meta text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1">
        {children || <span className="text-muted-foreground">не указано</span>}
      </dd>
    </div>
  );
}

function ContactCardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-6 rounded-card border p-5 md:p-7">
        <div className="flex items-center gap-4">
          <span className="size-14 animate-pulse rounded-full bg-avatar/50 md:size-16" />
          <div className="flex flex-col gap-3">
            <span className="h-6 w-48 animate-pulse rounded-full bg-skeleton/60" />
            <span className="h-3 w-64 animate-pulse rounded-full bg-skeleton/60" />
          </div>
        </div>
        <span className="h-16 w-full animate-pulse rounded-field bg-skeleton/60" />
      </div>
      <span className="h-24 w-full animate-pulse rounded-field bg-skeleton/60" />
    </div>
  );
}
