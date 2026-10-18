import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { contactFormFrom } from "@/lib/contact-form";
import { getContact, parseContactId } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<EditFormSkeleton />}>
        <EditContact params={params} />
      </Suspense>
    </div>
  );
}

async function EditContact({
  params,
}: {
  params: PageProps<"/contacts/[id]/edit">["params"];
}) {
  const id = parseContactId((await params).id);
  if (id === null) {
    notFound();
  }

  const contact = await getContact(id);
  if (!contact) {
    notFound();
  }

  return (
    <>
      <BackLink href={`/contacts/${contact.id}`}>К карточке контакта</BackLink>
      <div className="rounded-card border p-5 md:p-7">
        <h1 className="mb-6 text-h1 font-light md:mb-8">Изменить контакт</h1>
        <ContactForm
          action={updateContact.bind(null, contact.id)}
          initialState={contactFormFrom(contact)}
          submitLabel="Сохранить изменения"
          cancelHref={`/contacts/${contact.id}`}
        />
      </div>
    </>
  );
}

function EditFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="h-4 w-36 animate-pulse rounded-full bg-skeleton/60" />
      <div className="flex flex-col gap-5 rounded-card border p-5 md:p-7">
        <span className="h-8 w-56 animate-pulse rounded-full bg-skeleton/60" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <span className="h-3 w-28 animate-pulse rounded-full bg-skeleton/60" />
            <span className="h-11 w-full animate-pulse rounded-field bg-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
