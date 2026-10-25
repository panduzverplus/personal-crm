import { KeepInTouchList } from "@/components/keep-in-touch-list";
import { getOverdueContacts } from "@/lib/contacts";
import { formatDate } from "@/lib/format";
import { frequencyInline } from "@/lib/keep-in-touch";

/** The "Пора связаться" block on the home page; renders nothing when nobody is overdue. */
export async function KeepInTouch() {
  const overdue = await getOverdueContacts();
  if (overdue.length === 0) {
    return null;
  }

  return (
    <KeepInTouchList
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
