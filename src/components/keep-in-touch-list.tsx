"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ContactAvatar } from "@/components/contact-avatar";
import { LinkList } from "@/components/link-list";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";

const VISIBLE_ROWS = 5;

const CONTACT_FORMS: [string, string, string] = [
  "контакт",
  "контакта",
  "контактов",
];

export type KeepInTouchRow = { id: number; name: string; details: string };

/** Shows the first five overdue contacts; the rest open with "Показать всех". */
export function KeepInTouchList({ rows }: { rows: KeepInTouchRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const visibleRows = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  function collapse() {
    // Apply the collapse first, then measure where the block ended up.
    flushSync(() => setExpanded(false));
    const section = sectionRef.current;
    // After collapsing a long list the block can be above the screen: bring it back.
    if (section && section.getBoundingClientRect().top < 0) {
      section.scrollIntoView({ block: "start" });
    }
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="keep-in-touch-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      {/* Section heading with a line on top, as on the landing */}
      <div className="flex items-baseline justify-between gap-4 border-t pt-3.5 md:pt-4">
        <h2 id="keep-in-touch-heading" className="text-h2 font-light">
          Пора связаться
        </h2>
        <span className="font-mono text-meta text-muted-foreground uppercase">
          {pluralize(rows.length, CONTACT_FORMS)}
        </span>
      </div>

      {/* Frame and rows as in the contact list */}
      <LinkList className="divide-y divide-search overflow-hidden rounded-card border p-1.5 md:p-2">
        {visibleRows.map((row) => (
          <li key={row.id}>
            {/* A plain <a>: LinkList opens it without a page reload. */}
            <a
              href={`/contacts/${row.id}`}
              className="flex items-center gap-3 rounded-field px-3 py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ContactAvatar name={row.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{row.name}</div>
                <div className="text-sm text-muted-foreground">
                  {row.details}
                </div>
              </div>
            </a>
          </li>
        ))}
      </LinkList>

      {rows.length > VISIBLE_ROWS && (
        <Button
          variant="outline"
          className="self-start"
          onClick={expanded ? collapse : () => setExpanded(true)}
        >
          {expanded ? "Свернуть" : `Показать всех · ${rows.length}`}
        </Button>
      )}
    </section>
  );
}
