import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function ContactAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full bg-avatar text-sm font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
