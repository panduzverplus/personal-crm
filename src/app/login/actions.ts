"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth, LOGIN_ERROR } from "@/lib/auth";
import type { LoginFormState } from "@/lib/login-form";
import { parseLoginEmail } from "@/lib/login-email";

/**
 * Asks for a login link. The address is checked here to show the message under the field, and
 * again inside Better Auth for requests that do not come from this form. For a new and a known
 * address the answer is the same: the first login creates the user.
 */
export async function requestLoginLink(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = parseLoginEmail(typed);
  if (!parsed.ok) {
    return { status: "invalid", email: typed };
  }

  try {
    await auth.api.signInMagicLink({
      body: {
        email: parsed.email,
        // After the link: always the home page, an expired link leads to its own page.
        callbackURL: "/",
        newUserCallbackURL: "/",
        errorCallbackURL: "/login/expired",
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === LOGIN_ERROR.tooManyLetters) {
      return { status: "limited", email: typed };
    }
    if (isAPIError(error) && error.body?.code !== LOGIN_ERROR.sendFailed) {
      // Not one of ours (for example the library refused the request): worth a line in the log.
      console.error("Login link request was refused", error);
    }
    return { status: "failed", email: typed };
  }

  return { status: "sent", email: typed, sentTo: parsed.email };
}

/** Ends the session of this device only, then opens the login page. */
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
