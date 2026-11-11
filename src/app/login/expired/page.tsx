import type { Metadata } from "next";
import Link from "next/link";
import { BigLetter } from "@/components/big-letter";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ссылка устарела",
};

// Every failed link ends here: used, older than 15 minutes, cancelled by a newer one or damaged.
// The person does not need to know which of them it was.
export default function LinkExpiredPage() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-card border px-6 py-12 text-center">
      <BigLetter />
      <h1 className="text-h2 font-light">Ссылка устарела, запроси новую</h1>
      <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
        Получить новую ссылку
      </Link>
    </div>
  );
}
