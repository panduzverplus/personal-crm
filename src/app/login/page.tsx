import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requestLoginLink } from "@/app/login/actions";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Вход",
};

export default function LoginPage() {
  return (
    <div className="rounded-card border p-5 md:p-7">
      <h1 className="mb-6 text-h1 font-light md:mb-8">Вход</h1>
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}

async function LoginContent() {
  // Someone who is already in does not need to log in again.
  if (await getCurrentUser()) {
    redirect("/");
  }
  return <LoginForm action={requestLoginLink} />;
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <span className="h-3 w-16 animate-pulse rounded-full bg-skeleton/60" />
        <span className="h-12 w-full animate-pulse rounded-field bg-input" />
      </div>
      <span className="h-12 w-44 animate-pulse rounded-full bg-skeleton/60" />
    </div>
  );
}
