import "server-only";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { and, count, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEmailSends, verifications } from "@/db/schema";
import { LOGIN_LINK_MINUTES, parseLoginEmail } from "@/lib/login-email";
import { sendLoginEmail } from "@/lib/mail";
import { SESSION_EXPIRES_IN, SESSION_UPDATE_AGE } from "@/lib/session-config";

// Login by a link from an email, with Better Auth. There are no passwords.
// The first login of an address creates the user. Cookie and session handling is the library's.

/** At most this many letters per address in `LIMIT_WINDOW_MINUTES`. */
const LIMIT_LETTERS = 3;
const LIMIT_WINDOW_MINUTES = 10;

/** Error codes of `sendMagicLink`, so the login form can tell the cases apart. */
export const LOGIN_ERROR = {
  tooManyLetters: "TOO_MANY_LOGIN_EMAILS",
  sendFailed: "LOGIN_EMAIL_SEND_FAILED",
} as const;

/** How the token is kept in the database: only a hash, a copy of the database does not let anyone in. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The `identifier` under which Better Auth keeps a login link in `verifications`. */
function linkIdentifier(token: string) {
  return `magic-link:${hashToken(token)}`;
}

async function deleteLink(identifier: string) {
  await db.delete(verifications).where(eq(verifications.identifier, identifier));
}

/**
 * The only place from which a login letter goes out, so the rules hold for every request,
 * not only for the ones from the form. Better Auth has already stored the new link.
 * In one transaction, one address at a time (a lock on the address):
 *  1. more than LIMIT_LETTERS letters to this address in the window: refuse, the new link is deleted
 *     and the previous one keeps working;
 *  2. otherwise delete the links of the previous letters to this address and count this letter;
 *  3. send the letter. If it cannot be sent, the transaction is rolled back: the letter is not
 *     counted, the previous links stay alive, and the new link is deleted.
 */
async function sendLoginLink({ email, url, token }: { email: string; url: string; token: string }) {
  const identifier = linkIdentifier(token);

  let limited: boolean;
  try {
    limited = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

      // Old rows are of no use: only the last minutes are counted.
      await tx
        .delete(loginEmailSends)
        .where(lt(loginEmailSends.sentAt, sql`now() - interval '1 day'`));
      const [{ recent }] = await tx
        .select({ recent: count() })
        .from(loginEmailSends)
        .where(
          and(
            eq(loginEmailSends.email, email),
            gt(loginEmailSends.sentAt, sql`now() - ${`${LIMIT_WINDOW_MINUTES} minutes`}::interval`),
          ),
        );
      if (recent >= LIMIT_LETTERS) {
        return true;
      }

      // Cancel the links of the letters already sent to this address. Only those: two requests
      // at once wait for the lock one after the other, and the one that goes first must not
      // delete the link of the one that goes second. So the letter sent last always has a live link.
      const earlier = await tx
        .select({ linkIdentifier: loginEmailSends.linkIdentifier })
        .from(loginEmailSends)
        .where(eq(loginEmailSends.email, email));
      if (earlier.length > 0) {
        await tx.delete(verifications).where(
          inArray(
            verifications.identifier,
            earlier.map((row) => row.linkIdentifier),
          ),
        );
      }
      await tx.insert(loginEmailSends).values({ email, linkIdentifier: identifier });
      await sendLoginEmail(email, url);
      return false;
    });
  } catch (error) {
    console.error("Failed to send the login email", error);
    await deleteLink(identifier);
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Could not send the login email",
      code: LOGIN_ERROR.sendFailed,
    });
  }

  if (limited) {
    await deleteLink(identifier);
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Too many login emails for this address",
      code: LOGIN_ERROR.tooManyLetters,
    });
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  session: {
    // 30 days from the last visit on this device; a visit moves the end, at most once a day.
    // The cookie in the browser is renewed by src/proxy.ts: a Server Component cannot set cookies.
    expiresIn: SESSION_EXPIRES_IN,
    updateAge: SESSION_UPDATE_AGE,
    // No cookie cache: a logout or an expired session must be seen at once.
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/magic-link") {
        return;
      }
      // The same check as in the form, for a request that did not come from it.
      const parsed = parseLoginEmail((ctx.body as { email?: unknown } | undefined)?.email);
      if (!parsed.ok) {
        throw new APIError("BAD_REQUEST", { message: "Invalid email" });
      }
      return { context: { ...ctx, body: { ...ctx.body, email: parsed.email } } };
    }),
  },
  plugins: [
    magicLink({
      expiresIn: LOGIN_LINK_MINUTES * 60,
      allowedAttempts: 1,
      storeToken: { type: "custom-hasher", hash: async (token) => hashToken(token) },
      // Per address the limit is above. Per IP (for requests over HTTP, behind nginx): 10 a minute.
      rateLimit: { window: 60, max: 10 },
      sendMagicLink: sendLoginLink,
    }),
    // Lets server actions set and delete the session cookie. Must be the last plugin.
    nextCookies(),
  ],
});
