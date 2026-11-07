import type { Metadata } from "next";
import { Suspense } from "react";
import { createGroup, deleteGroup, renameGroup } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { CreateGroupForm } from "@/components/create-group-form";
import { GroupRow } from "@/components/group-row";
import { listGroupsWithCounts } from "@/lib/groups";

export const metadata: Metadata = {
  title: "Группы",
};

export default function GroupsPage() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <BackLink />
      <h1 className="text-h1 font-light">Группы</h1>
      <Suspense fallback={<GroupsSkeleton />}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Groups() {
  const groups = await listGroupsWithCounts();

  return (
    <div className="flex flex-col gap-6">
      <CreateGroupForm action={createGroup} />

      {groups.length === 0 ? (
        <p className="rounded-card border px-6 py-10 text-center text-muted-foreground">
          Групп пока нет. Создайте первую.
        </p>
      ) : (
        <ul className="flex flex-col">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              groupId={group.id}
              name={group.name}
              contactCount={group.contactCount}
              renameAction={renameGroup.bind(null, group.id)}
              deleteAction={deleteGroup.bind(null, group.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <span className="h-3 w-28 animate-pulse rounded-full bg-skeleton/60" />
        <span className="h-12 w-full animate-pulse rounded-field bg-input" />
      </div>
      <ul className="flex flex-col">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="flex items-center gap-4 border-t py-4 last:border-b">
            <span className="h-3 w-40 animate-pulse rounded-full bg-skeleton/60" />
            <span className="ml-auto h-7 w-24 animate-pulse rounded-full bg-skeleton/60" />
          </li>
        ))}
      </ul>
    </div>
  );
}
