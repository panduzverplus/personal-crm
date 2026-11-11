"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * On the login pages ("/login" and "/login/expired") the header has only the logo and the label,
 * even if the visitor happens to be signed in; everywhere else it shows the account.
 */
export function HeaderAccountSlot({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const onLoginPages = pathname === "/login" || pathname.startsWith("/login/");
  return onLoginPages ? fallback : children;
}
