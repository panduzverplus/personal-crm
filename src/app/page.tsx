import Link from "next/link";
import { Suspense } from "react";
import { UserPlusIcon } from "lucide-react";
import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import {
  ContactSearch,
  ContactSearchFallback,
} from "@/components/contact-search";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ContactsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
        <Link
          href="/contacts/new"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          <UserPlusIcon data-icon="inline-start" />
          Добавить контакт
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
