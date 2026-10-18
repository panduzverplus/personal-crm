import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import {
  ContactSearch,
  ContactSearchFallback,
} from "@/components/contact-search";
import { ButtonBadge, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
        <h1 className="text-h1 font-light">Контакты</h1>
        {/* On phones the button spans the screen, as on the landing */}
        <Link
          href="/contacts/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "max-md:w-full max-md:justify-between",
          )}
        >
          Добавить контакт
          <ButtonBadge>
            <PlusIcon />
          </ButtonBadge>
        </Link>
      </div>

      <Suspense fallback={<ContactSearchFallback />}>
        <ContactSearch searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
