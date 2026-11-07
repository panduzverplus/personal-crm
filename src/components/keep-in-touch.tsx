import { KeepInTouchList } from "@/components/keep-in-touch-list";
import { getOverdueContacts } from "@/lib/contacts";
import { formatDate } from "@/lib/format";
import { frequencyInline } from "@/lib/keep-in-touch";

/**
 * The "Пора связаться" block on the home page; renders nothing when nobody is overdue.
 * With a group selected, it shows only the people of that group.
 */
export async function KeepInTouch({
  groupId,
  listQuery,
}: {
  groupId: number | null;
  /** The group and search of the page, added to the card links so the card can lead back. */
  listQuery: string;
}) {
  const overdue = await getOverdueContacts(groupId);
  if (overdue.length === 0) {
    return null;
  }

  return (
    // Another group is another set of people: the block starts collapsed again.
    <KeepInTouchList
      key={groupId ?? "all"}
      listQuery={listQuery}
      rows={overdue.map((contact) => ({
        id: contact.id,
        name: contact.name,
        details: `${frequencyInline(contact.frequency)} · ${
          contact.lastNoteAt
            ? `последняя заметка ${formatDate(contact.lastNoteAt)}`
            : "заметок пока нет"
        }`,
      }))}
    />
  );
}
