import { signOut } from "@/app/login/actions";
import { HeaderAccountSlot } from "@/components/header-account-slot";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

/** The right side of the header: the signed-in email and "Выйти" (this device only). */
export function HeaderAccount() {
  return (
    <HeaderAccountSlot fallback={<Label />}>
      <Account />
    </HeaderAccountSlot>
  );
}

function Label() {
  return <span className="font-mono text-label">ЛИЧНЫЕ КОНТАКТЫ</span>;
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) {
    return <Label />;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* A long address is cut off, so the header never gets wider than a phone screen. */}
      <span className="min-w-0 truncate font-mono text-meta" title={user.email}>
        {user.email}
      </span>
      <form action={signOut} className="shrink-0">
        <Button type="submit" variant="outline" size="sm">
          Выйти
        </Button>
      </form>
    </div>
  );
}
