import { ContactBlock } from "@/components/contact-block";
import { birthdayRowDetails } from "@/lib/birthday";
import { getUpcomingBirthdays } from "@/lib/contacts";

/**
 * The "Скоро день рождения" block on the home page; renders nothing when nobody has a birthday
 * today or in the next 7 days. With a group selected, it shows only the people of that group.
 */
export async function Birthdays({
  userId,
  groupId,
  listQuery,
}: {
  userId: string;
  groupId: number | null;
  /** The group and search of the page, added to the card links so the card can lead back. */
  listQuery: string;
}) {
  const upcoming = await getUpcomingBirthdays(userId, groupId);
  if (upcoming.length === 0) {
    return null;
  }

  return (
    // Another group is another set of people: the block starts collapsed again.
    <ContactBlock
      key={groupId ?? "all"}
      title="Скоро день рождения"
      headingId="birthdays-heading"
      listQuery={listQuery}
      rows={upcoming.map((contact) => ({
        id: contact.id,
        name: contact.name,
        details: birthdayRowDetails(contact),
      }))}
    />
  );
}
