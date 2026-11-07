"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { useListControls } from "@/components/list-controls";
import { Input } from "@/components/ui/input";
import { listQueryString } from "@/lib/list-params";

const DEBOUNCE_MS = 250;

/**
 * Live search by name: keeps the query in the URL (?q=...), the server filters the list.
 * Takes the query from the page's searchParams (not useSearchParams) so the input is server-rendered
 * and usable before hydration finishes. The selected group stays in the URL while searching.
 */
export function ContactSearch({ query: urlQuery }: { query: string }) {
  const router = useRouter();
  const { queryRef, groupRef } = useListControls();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastNavigatedRef = useRef(urlQuery);

  // Sync the input when the URL changes from outside (e.g. the header link resets the search).
  useEffect(() => {
    if (urlQuery !== lastNavigatedRef.current) {
      lastNavigatedRef.current = urlQuery;
      if (inputRef.current) inputRef.current.value = urlQuery;
    }
  }, [urlQuery]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function navigate(rawQuery: string) {
    clearTimeout(timerRef.current);
    const query = rawQuery.trim();
    if (query === lastNavigatedRef.current) return;
    lastNavigatedRef.current = query;
    // Read at the moment the timer fires, so a group picked while typing is not undone.
    const href = `/${listQueryString({ group: groupRef.current, q: query })}`;
    startTransition(() => router.replace(href, { scroll: false }));
  }

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(inputRef.current?.value ?? "");
      }}
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-search-icon"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={urlQuery}
        onChange={(event) => {
          const value = event.target.value;
          queryRef.current = value.trim();
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => navigate(value), DEBOUNCE_MS);
        }}
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        autoComplete="off"
        // The browser's blue "clear" cross, recolored to the ink of the palette
        className="h-12.5 pr-11 pl-11 [&::-webkit-search-cancel-button]:brightness-0"
      />
      {isPending && (
        <LoaderCircleIcon
          aria-label="Ищу…"
          className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      )}
    </form>
  );
}

export function ContactSearchFallback() {
  return (
    <div className="relative">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-search-icon"
      />
      <Input
        disabled
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        className="h-12.5 pl-11"
      />
    </div>
  );
}
