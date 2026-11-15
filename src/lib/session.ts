import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = { id: string; email: string };

/**
 * The user of the current request, or null without a valid session. Checked in the database on
 * every call (no cookie cache), so a logout or an expired session is seen at once. Asked many
 * times during one request (page, header, actions), it reads the database once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email } : null;
});

/**
 * The first line of every page with data and of every server action. Without a session it goes
 * to the login page, so nothing is read or changed. The user id for `src/lib` comes only from here,
 * never from the browser.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
