import Link from "next/link";
import { BigLetter } from "@/components/big-letter";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ContactNotFound() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-card border px-6 py-12 text-center">
      <BigLetter />
      <h1 className="text-h2 font-light">Контакт не найден</h1>
      <p className="text-muted-foreground">
        Проверьте ссылку или найдите человека в общем списке.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
        К списку контактов
      </Link>
    </div>
  );
}
