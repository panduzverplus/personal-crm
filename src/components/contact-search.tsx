"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;

/**
 * Live search by name: keeps the query in the URL (?q=...), the server filters the list.
 * Reads the page's searchParams (not useSearchParams) so the input is server-rendered
 * and usable before hydration finishes.
 */
export function ContactSearch({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const router = useRouter();
  const rawQuery = use(searchParams).q;
  const urlQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? "";
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
    const href = query ? `/?${new URLSearchParams({ q: query })}` : "/";
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={urlQuery}
        onChange={(event) => {
          const value = event.target.value;
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => navigate(value), DEBOUNCE_MS);
        }}
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        autoComplete="off"
        className="h-10 bg-background pr-9 pl-9"
      />
      {isPending && (
        <LoaderCircleIcon
          aria-label="Ищу…"
          className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        disabled
        placeholder="Найти по имени"
        aria-label="Поиск по имени"
        className="h-10 bg-background pl-9"
      />
    </div>
  );
}
