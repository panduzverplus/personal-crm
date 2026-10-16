import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  CircleCheckIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
} from "lucide-react";
import { addNote, updateNote } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getContactWithNotes, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Карточка контакта — Личная CRM",
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
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CircleCheckIcon />
          <AlertTitle>Изменения сохранены</AlertTitle>
        </Alert>
      )}

      <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <ContactAvatar
            id={contact.id}
            name={contact.name}
            className="size-14 text-lg"
          />
          <div className="min-w-0 flex-1 self-center">
            <h1 className="text-2xl font-semibold tracking-tight break-words">
              {contact.name}
            </h1>
            {contact.about && (
              <p className="text-muted-foreground">{contact.about}</p>
            )}
          </div>
          <Link
            href={`/contacts/${contact.id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <PencilIcon data-icon="inline-start" />
            Изменить
          </Link>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail icon={<MapPinIcon />} label="Откуда знакомы" wide>
            {contact.howWeMet}
          </Detail>
          <Detail icon={<PhoneIcon />} label="Телефон">
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                className="tabular-nums underline-offset-4 hover:underline"
              >
                {contact.phone}
              </a>
            )}
          </Detail>
          <Detail icon={<MailIcon />} label="Почта">
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

        <p className="text-xs text-muted-foreground">
          В списке с {formatDate(contact.createdAt)}
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="notes-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="notes-heading" className="text-lg font-semibold">
            Заметки
          </h2>
          {notes.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {pluralize(notes.length, ["заметка", "заметки", "заметок"])}
            </span>
          )}
        </div>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-background px-5 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём договорились после разговора.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
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
  icon,
  label,
  wide,
  children,
}: {
  icon: ReactNode;
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground ${wide ? "sm:col-span-2" : ""}`}
    >
      {icon}
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>
          {children || <span className="text-muted-foreground">не указано</span>}
        </dd>
      </div>
    </div>
  );
}

function ContactCardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <span className="size-14 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-col gap-2">
            <span className="h-6 w-48 animate-pulse rounded bg-muted" />
            <span className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <span className="h-16 w-full animate-pulse rounded bg-muted" />
      </div>
      <span className="h-24 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
