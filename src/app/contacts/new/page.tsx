import type { Metadata } from "next";
import { createContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { emptyContactForm } from "@/lib/contact-form";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="rounded-card border p-5 md:p-7">
        <h1 className="mb-6 text-h1 font-light md:mb-8">Новый контакт</h1>
        <ContactForm
          action={createContact}
          initialState={emptyContactForm}
          submitLabel="Сохранить контакт"
          cancelHref="/"
        />
      </div>
    </div>
  );
}
