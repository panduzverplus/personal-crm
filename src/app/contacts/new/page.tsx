import type { Metadata } from "next";
import { createContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { emptyContactForm } from "@/lib/contact-form";

export const metadata: Metadata = {
  title: "Новый контакт — Личная CRM",
};

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight">
          Новый контакт
        </h1>
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
