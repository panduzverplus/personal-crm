"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type ListControls = {
  /** The text in the search field right now, trimmed; it may not be in the address yet. */
  queryRef: RefObject<string>;
  /** The group the user picked last; the address may not show it yet. */
  groupRef: RefObject<number | null>;
};

const ListControlsContext = createContext<ListControls | null>(null);

/**
 * Lets the group buttons and the search field see each other's latest choice.
 * The search waits 250 ms before it changes the address, so without this a click on a group
 * right after typing would be undone by the search, and the typed text would be lost.
 */
export function ListControlsProvider({
  group,
  query,
  children,
}: {
  group: number | null;
  query: string;
  children: ReactNode;
}) {
  const queryRef = useRef(query);
  const groupRef = useRef(group);

  // The address is the source of truth once the page shows it.
  useEffect(() => {
    groupRef.current = group;
  }, [group]);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  // The refs never change, so neither does the context value.
  const controls = useMemo(() => ({ queryRef, groupRef }), []);
  return <ListControlsContext value={controls}>{children}</ListControlsContext>;
}

export function useListControls() {
  const controls = useContext(ListControlsContext);
  if (!controls) {
    throw new Error("useListControls must be used inside ListControlsProvider");
  }
  return controls;
}
