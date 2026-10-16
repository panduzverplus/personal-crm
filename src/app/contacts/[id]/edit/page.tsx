import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { contactFormFrom } from "@/lib/contact-form";
import { getContact, parseContactId } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Изменить контакт — Личная CRM",
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
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">
          Изменить контакт
        </h1>
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
      <span className="h-4 w-36 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-6">
        <span className="h-7 w-56 animate-pulse rounded bg-muted" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <span className="h-4 w-28 animate-pulse rounded bg-muted" />
            <span className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
