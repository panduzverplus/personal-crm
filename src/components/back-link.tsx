import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export function BackLink({
  href = "/",
  children = "Все контакты",
}: {
  href?: string;
  children?: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
