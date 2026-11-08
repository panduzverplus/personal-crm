import type { Metadata } from "next";
import { Suspense } from "react";
import { createContact, createGroup } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { ContactFormSkeleton } from "@/components/contact-form-skeleton";
import { emptyContactForm } from "@/lib/contact-form";
import { listGroups } from "@/lib/groups";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <Suspense fallback={<ContactFormSkeleton />}>
        <NewContact />
      </Suspense>
    </div>
  );
}

// The form needs the list of groups, which is read from the database on every request.
async function NewContact() {
  const groups = await listGroups();

  return (
    <div className="rounded-card border p-5 md:p-7">
      <h1 className="mb-6 text-h1 font-light md:mb-8">Новый контакт</h1>
      <ContactForm
        action={createContact}
        initialState={emptyContactForm}
        groups={groups}
        createGroupAction={createGroup}
        submitLabel="Сохранить контакт"
        cancelHref="/"
      />
    </div>
  );
}
