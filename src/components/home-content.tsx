import { ContactList } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { GroupFilter } from "@/components/group-filter";
import { KeepInTouch } from "@/components/keep-in-touch";
import { ListControlsProvider } from "@/components/list-controls";
import { listGroups } from "@/lib/groups";
import { listQueryString, parseListParams } from "@/lib/list-params";

/**
 * Everything under the page title: group buttons, "Пора связаться", search and the list.
 * The selected group is worked out once here, so the block and the list always agree on it.
 */
export async function HomeContent({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { group: groupId, q } = parseListParams(await searchParams);
  const groups = await listGroups();
  // A group in the address that no longer exists counts as "Все".
  const group = groups.find((item) => item.id === groupId) ?? null;

  return (
    <ListControlsProvider group={group?.id ?? null} query={q}>
      <GroupFilter
        groups={groups}
        activeGroup={group?.id ?? null}
        query={q}
      />
      <KeepInTouch
        groupId={group?.id ?? null}
        listQuery={listQueryString({ group: group?.id ?? null, q })}
      />
      <ContactSearch query={q} />
      <ContactList searchParams={searchParams} query={q} group={group} />
    </ListControlsProvider>
  );
}
