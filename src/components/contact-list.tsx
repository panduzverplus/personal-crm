import Link from "next/link";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import { BigLetter } from "@/components/big-letter";
import { ContactAvatar } from "@/components/contact-avatar";
import { ScrollIntoView } from "@/components/scroll-into-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ButtonBadge, buttonVariants } from "@/components/ui/button";
import { searchContacts, type ContactListItem } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONTACT_FORMS: [string, string, string] = [
  "контакт",
  "контакта",
  "контактов",
];

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export async function ContactList({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const params = await searchParams;
  const query = (firstValue(params.q) ?? "").trim();
  const addedId = Number(firstValue(params.added));

  const { items, total } = await searchContacts(query);
  const added = query
    ? undefined
    : items.find((contact) => contact.id === addedId);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-card border px-6 py-12 text-center">
        <BigLetter />
        <p className="text-muted-foreground">
          Пока нет ни одного контакта.
        </p>
        <Link href="/contacts/new" className={cn(buttonVariants())}>
          Добавить первый контакт
          <ButtonBadge>
            <PlusIcon />
          </ButtonBadge>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {added && (
        <>
          <Alert variant="success">
            <CircleCheckIcon />
            <AlertTitle>Контакт «{added.name}» добавлен</AlertTitle>
            <AlertDescription>
              Он подсвечен в списке.{" "}
              <Link href={`/contacts/${added.id}`}>Открыть карточку</Link>
            </AlertDescription>
          </Alert>
          <ScrollIntoView targetId={`contact-${added.id}`} />
        </>
      )}

      <p
        className="font-mono text-meta text-muted-foreground uppercase"
        aria-live="polite"
      >
        {query
          ? `Найдено: ${pluralize(items.length, CONTACT_FORMS)} из ${total.toLocaleString("ru-RU")}`
          : `Всего ${pluralize(total, CONTACT_FORMS)}`}
      </p>

      {items.length === 0 ? (
        <div className="rounded-card border px-6 py-10 text-center text-muted-foreground">
          По запросу «{query}» никого не нашлось.
        </div>
      ) : (
        // Frame and light dividers as in the app preview on the landing
        <ul className="divide-y divide-search overflow-hidden rounded-card border p-1.5 md:p-2">
          {items.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              highlighted={contact.id === added?.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  highlighted,
}: {
  contact: ContactListItem;
  highlighted: boolean;
}) {
  return (
    <li
      id={`contact-${contact.id}`}
      className={cn(highlighted && "rounded-field bg-muted ring-2 ring-ring ring-inset")}
    >
      <Link
        href={`/contacts/${contact.id}`}
        className="flex items-center gap-3 rounded-field px-3 py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ContactAvatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{contact.name}</div>
          {contact.about && (
            <div className="truncate text-sm text-muted-foreground">
              {contact.about}
            </div>
          )}
        </div>
        {/* Plain text, no icons: the row is repeated ~1000 times, so every byte counts. */}
        <div className="hidden max-w-56 shrink-0 text-right text-sm text-muted-foreground sm:block">
          {contact.phone && <div className="tabular-nums">{contact.phone}</div>}
          {contact.email && <div className="truncate">{contact.email}</div>}
        </div>
      </Link>
    </li>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded-full bg-skeleton/60" />
      {/* Same placeholder rows as in the app preview on the landing */}
      <ul className="divide-y divide-search overflow-hidden rounded-card border p-1.5 md:p-2">
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-3">
            <span className="size-11 animate-pulse rounded-full bg-avatar/50" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-2.5 w-40 animate-pulse rounded-full bg-skeleton/60" />
              <span className="h-2 w-56 animate-pulse rounded-full bg-skeleton/60" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
