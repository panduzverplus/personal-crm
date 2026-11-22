import { ContactBlock } from "@/components/contact-block";
import { getOverdueContacts } from "@/lib/contacts";
import { overdueRowDetails } from "@/lib/keep-in-touch";

/**
 * The "Пора связаться" block on the home page; renders nothing when nobody is overdue.
 * With a group selected, it shows only the people of that group.
 */
export async function KeepInTouch({
  userId,
  groupId,
  listQuery,
}: {
  userId: string;
  groupId: number | null;
  /** The group and search of the page, added to the card links so the card can lead back. */
  listQuery: string;
}) {
  const overdue = await getOverdueContacts(userId, groupId);
  if (overdue.length === 0) {
    return null;
  }

  return (
    // Another group is another set of people: the block starts collapsed again.
    <ContactBlock
      title="Пора связаться"
      headingId="keep-in-touch-heading"
      key={groupId ?? "all"}
      listQuery={listQuery}
      rows={overdue.map((contact) => ({
        id: contact.id,
        name: contact.name,
        details: overdueRowDetails(contact.frequency, contact.lastNoteAt),
      }))}
    />
  );
}
