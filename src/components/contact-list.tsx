import Link from "next/link";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import { BigLetter } from "@/components/big-letter";
import { ContactAvatar } from "@/components/contact-avatar";
import { LinkList } from "@/components/link-list";
import { ScrollIntoView } from "@/components/scroll-into-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ButtonBadge, buttonVariants } from "@/components/ui/button";
import { searchContacts, type ContactListItem } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import type { GroupRef } from "@/lib/group-form";
import { listQueryString } from "@/lib/list-params";
import { cn } from "@/lib/utils";

const CONTACT_FORMS: [string, string, string] = ["контакт", "контакта", "контактов"];

const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export async function ContactList({
  searchParams,
  query,
  group,
}: {
  searchParams: PageProps<"/">["searchParams"];
  query: string;
  /** The selected group; null shows everyone. */
  group: GroupRef | null;
}) {
  const params = await searchParams;
  const listQuery = listQueryString({ group: group?.id ?? null, q: query });
  const addedId = Number(firstValue(params.added));
  const deletedName = (firstValue(params.deleted) ?? "").trim();

  const { items, total, groupTotal } = await searchContacts(query, group?.id ?? null);
  const added = query ? undefined : items.find((contact) => contact.id === addedId);

  const deletedAlert = deletedName && (
    <Alert variant="success">
      <CircleCheckIcon />
      <AlertTitle className="break-words">Контакт «{deletedName}» удалён</AlertTitle>
    </Alert>
  );

  if (total === 0) {
    return (
      <div className="flex flex-col gap-3">
        {deletedAlert}
        <div className="flex flex-col items-center gap-5 rounded-card border px-6 py-12 text-center">
          <BigLetter />
          <p className="text-muted-foreground">Пока нет ни одного контакта.</p>
          <Link href="/contacts/new" className={cn(buttonVariants())}>
            Добавить первый контакт
            <ButtonBadge>
              <PlusIcon />
            </ButtonBadge>
          </Link>
        </div>
      </div>
    );
  }

  // A group without anyone: no list to show, with or without a search.
  if (group && groupTotal === 0) {
    return (
      <div className="flex flex-col gap-3">
        {deletedAlert}
        <div className="rounded-card border px-6 py-10 text-center text-muted-foreground">
          В группе «{group.name}» пока никого нет.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {deletedAlert}
      {added && (
        <>
          <Alert variant="success">
            <CircleCheckIcon />
            <AlertTitle>Контакт «{added.name}» добавлен</AlertTitle>
            <AlertDescription>
              Он подсвечен в списке. <Link href={`/contacts/${added.id}`}>Открыть карточку</Link>
            </AlertDescription>
          </Alert>
          <ScrollIntoView targetId={`contact-${added.id}`} />
        </>
      )}

      <p className="font-mono text-meta text-muted-foreground uppercase" aria-live="polite">
        {query
          ? `Найдено: ${pluralize(items.length, CONTACT_FORMS)} из ${groupTotal.toLocaleString("ru-RU")}`
          : group
            ? `В группе «${group.name}»: ${pluralize(groupTotal, CONTACT_FORMS)}`
            : `Всего ${pluralize(total, CONTACT_FORMS)}`}
      </p>

      {items.length === 0 ? (
        <div className="rounded-card border px-6 py-10 text-center text-muted-foreground">
          {group
            ? `В группе «${group.name}» по запросу «${query}» никого не нашлось.`
            : `По запросу «${query}» никого не нашлось.`}
        </div>
      ) : (
        // Frame and light dividers as in the app preview on the landing
        <LinkList className="divide-y divide-search overflow-hidden rounded-card border p-1.5 md:p-2">
          {items.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              listQuery={listQuery}
              highlighted={contact.id === added?.id}
            />
          ))}
        </LinkList>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  listQuery,
  highlighted,
}: {
  contact: ContactListItem;
  /** The group and search of the list ("" for the full list), so the card can lead back to it. */
  listQuery: string;
  highlighted: boolean;
}) {
  return (
    <li
      id={`contact-${contact.id}`}
      className={cn(highlighted && "rounded-field bg-muted ring-2 ring-ring ring-inset")}
    >
      {/* A plain <a>: LinkList opens it without a page reload. */}
      <a
        href={`/contacts/${contact.id}${listQuery}`}
        className="flex items-center gap-3 rounded-field px-3 py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ContactAvatar name={contact.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{contact.name}</div>
          {contact.about && (
            <div className="truncate text-sm text-muted-foreground">{contact.about}</div>
          )}
          {contact.groups.length > 0 && (
            // Small text on one line, cut off when long, so the row stays compact.
            <div className="truncate text-xs text-muted-foreground">
              {contact.groups.join(" · ")}
            </div>
          )}
        </div>
        {/* Plain text, no icons: the row is repeated ~1000 times, so every byte counts. */}
        <div className="hidden max-w-56 shrink-0 text-right text-sm text-muted-foreground sm:block">
          {contact.phone && <div className="tabular-nums">{contact.phone}</div>}
          {contact.email && <div className="truncate">{contact.email}</div>}
        </div>
      </a>
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
