import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createGroup, updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { ContactFormSkeleton } from "@/components/contact-form-skeleton";
import { contactFormFrom } from "@/lib/contact-form";
import { getContact, getContactGroups, parseContactId } from "@/lib/contacts";
import { listGroups } from "@/lib/groups";
import { parseListParams, pathWithListParams } from "@/lib/list-params";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default function EditContactPage({
  params,
  searchParams,
}: PageProps<"/contacts/[id]/edit">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<EditFormSkeleton />}>
        <EditContact params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditContact({
  params,
  searchParams,
}: Pick<PageProps<"/contacts/[id]/edit">, "params" | "searchParams">) {
  const [{ id: rawId }, search] = await Promise.all([params, searchParams]);
  // The list the card was opened from: "Cancel", the link back and saving all return to it.
  const list = parseListParams(search);
  const id = parseContactId(rawId);
  if (id === null) {
    notFound();
  }

  const [contact, contactGroups, groups] = await Promise.all([
    getContact(id),
    getContactGroups(id),
    listGroups(),
  ]);
  if (!contact) {
    notFound();
  }

  const cardPath = pathWithListParams(`/contacts/${contact.id}`, list);

  return (
    <>
      <BackLink href={cardPath}>К карточке контакта</BackLink>
      <div className="rounded-card border p-5 md:p-7">
        <h1 className="mb-6 text-h1 font-light md:mb-8">Изменить контакт</h1>
        <ContactForm
          action={updateContact.bind(null, contact.id, list)}
          initialState={contactFormFrom(
            contact,
            contactGroups.map((group) => group.id),
          )}
          groups={groups}
          createGroupAction={createGroup}
          submitLabel="Сохранить изменения"
          cancelHref={cardPath}
        />
      </div>
    </>
  );
}

function EditFormSkeleton() {
  return (
    <>
      <span className="h-4 w-36 animate-pulse rounded-full bg-skeleton/60" />
      <ContactFormSkeleton />
    </>
  );
}
