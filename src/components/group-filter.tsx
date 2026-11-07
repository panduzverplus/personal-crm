"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { useListControls } from "@/components/list-controls";
import { buttonVariants } from "@/components/ui/button";
import type { GroupRef } from "@/lib/group-form";
import { listQueryString } from "@/lib/list-params";
import { cn } from "@/lib/utils";

/** Row of buttons above the "Пора связаться" block: "Все", one per group, and the link to the groups page. */
export function GroupFilter({
  groups,
  activeGroup,
  query,
}: {
  groups: GroupRef[];
  activeGroup: number | null;
  query: string;
}) {
  const router = useRouter();
  const { queryRef, groupRef } = useListControls();
  const [pending, startTransition] = useTransition();

  function select(event: MouseEvent<HTMLAnchorElement>, group: number | null) {
    // Ctrl, Cmd, Shift or the middle button: let the browser open a new tab.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    groupRef.current = group;
    // The text typed in the search field is kept, even if the search has not applied it yet.
    const href = `/${listQueryString({ group, q: queryRef.current })}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }

  const buttons: { id: number | null; label: string }[] = [
    { id: null, label: "Все" },
    ...groups.map((group) => ({ id: group.id, label: group.name })),
  ];

  return (
    <nav
      aria-label="Фильтр по группе"
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {buttons.map((button) => {
        const active = button.id === activeGroup;
        return (
          <Link
            key={button.id ?? "all"}
            // Without JavaScript, or in a new tab, the link opens the list for this group.
            href={`/${listQueryString({ group: button.id, q: query })}`}
            scroll={false}
            replace
            aria-current={active ? "true" : undefined}
            onClick={(event) => select(event, button.id)}
            className={cn(
              buttonVariants({
                variant: active ? "default" : "outline",
                size: "sm",
              }),
              "max-w-full min-w-0",
            )}
          >
            <span className="truncate">{button.label}</span>
          </Link>
        );
      })}
      <Link
        href="/groups"
        className={cn(buttonVariants({ variant: "link", size: "sm" }))}
      >
        Настроить группы
      </Link>
    </nav>
  );
}

export function GroupFilterSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="h-8 w-20 animate-pulse rounded-full bg-skeleton/60"
        />
      ))}
    </div>
  );
}
