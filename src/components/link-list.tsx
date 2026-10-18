"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  type ComponentProps,
  type MouseEvent,
  type SyntheticEvent,
} from "react";

/** The link the event came from, if it leads to a page of this app in the same tab. */
function appLinkOf(event: SyntheticEvent) {
  const link = (event.target as Element).closest("a");
  return link && link.origin === location.origin && !link.target ? link : null;
}

/**
 * A list of plain <a> links that open without a full page reload, like <Link>.
 * One handler for the whole list instead of a <Link> per row: the contact list
 * has ~1000 rows, and that many <Link>s noticeably delay the page becoming responsive.
 * A page is prefetched when the pointer, a finger or the keyboard focus reaches its link.
 */
export function LinkList(props: ComponentProps<"ul">) {
  const router = useRouter();
  // mouseover fires on every child of a row, so skip repeats for the same link.
  const lastPrefetchedRef = useRef("");

  function prefetch(event: SyntheticEvent) {
    const link = appLinkOf(event);
    if (!link || link.href === lastPrefetchedRef.current) return;
    lastPrefetchedRef.current = link.href;
    router.prefetch(link.pathname + link.search);
  }

  function navigate(event: MouseEvent) {
    const link = appLinkOf(event);
    // Ctrl, Cmd, Shift or the middle button: let the browser open a new tab or window.
    if (
      !link ||
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
    router.push(link.pathname + link.search + link.hash);
  }

  return (
    <ul
      {...props}
      onClick={navigate}
      onMouseOver={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
    />
  );
}
