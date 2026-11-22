import { CircleCheckIcon } from "lucide-react";
import { Birthdays } from "@/components/birthdays";
import { ContactList } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { GroupFilter } from "@/components/group-filter";
import { KeepInTouch } from "@/components/keep-in-touch";
import { ListControlsProvider } from "@/components/list-controls";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { listGroups } from "@/lib/groups";
import { listQueryString, parseListParams } from "@/lib/list-params";
import { requireUser } from "@/lib/session";

/**
 * Everything under the page title: group buttons, "Скоро день рождения", "Пора связаться", search and the list.
 * The selected group is worked out once here, so the blocks and the list always agree on it.
 */
export async function HomeContent({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { group: groupId, q } = parseListParams(params);
  const groups = await listGroups(user.id);
  // A group in the address that does not exist or is someone else's counts as "Все".
  const group = groups.find((item) => item.id === groupId) ?? null;
  // The group and search added to the card links of both blocks, so the card can lead back.
  const listQuery = listQueryString({ group: group?.id ?? null, q });

  return (
    <ListControlsProvider group={group?.id ?? null} query={q}>
      {/* On top, not in the list: under "Пора связаться" it falls below the first screen. */}
      {params.deleted === "1" && (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Контакт удалён</AlertTitle>
        </Alert>
      )}
      <GroupFilter groups={groups} activeGroup={group?.id ?? null} query={q} />
      {/* Birthdays are tied to a date, so they go above the overdue contacts. */}
      <Birthdays userId={user.id} groupId={group?.id ?? null} listQuery={listQuery} />
      <KeepInTouch userId={user.id} groupId={group?.id ?? null} listQuery={listQuery} />
      <ContactSearch query={q} />
      <ContactList userId={user.id} searchParams={searchParams} query={q} group={group} />
    </ListControlsProvider>
  );
}
