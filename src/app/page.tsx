import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { ContactListSkeleton } from "@/components/contact-list";
import { ContactSearchFallback } from "@/components/contact-search";
import { GroupFilterSkeleton } from "@/components/group-filter";
import { HomeContent } from "@/components/home-content";
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
          className={cn(buttonVariants({ size: "lg" }), "max-md:w-full max-md:justify-between")}
        >
          Добавить контакт
          <ButtonBadge>
            <PlusIcon />
          </ButtonBadge>
        </Link>
      </div>

      {/*
        One boundary for the group buttons, the "Пора связаться" block, the search and the list:
        React reveals streamed boundaries at most once per 300 ms, so a separate boundary showed up 300 ms late.
      */}
      <Suspense
        fallback={
          <>
            <GroupFilterSkeleton />
            <ContactSearchFallback />
            <ContactListSkeleton />
          </>
        }
      >
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
