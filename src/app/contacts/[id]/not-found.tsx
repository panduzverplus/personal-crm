import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ContactNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <h1 className="text-xl font-semibold">Контакт не найден</h1>
      <p className="text-muted-foreground">
        Проверьте ссылку или найдите человека в общем списке.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
        К списку контактов
      </Link>
    </div>
  );
}
