import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/db";
import { loginEmailSends, sessions, users, verifications } from "@/db/schema";
import { resetDatabase } from "@/test/db";
import { addUser } from "@/test/factories";

// The mail server is replaced: the tests look at what would be sent. The database is the real one.
vi.mock("@/lib/mail", () => ({ sendLoginEmail: vi.fn() }));

import { sendLoginEmail } from "@/lib/mail";
import { auth } from "@/lib/auth";

const sendMail = vi.mocked(sendLoginEmail);
const MINUTE = 60 * 1000;

function requestLink(email: string) {
  return auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
}

/** The tokens of the letters sent so far, in the order of sending. */
function sentTokens() {
  return sendMail.mock.calls.map(([, url]) => new URL(url).searchParams.get("token")!);
}

function openLink(token: string) {
  return auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
}

async function expectRejectedWith(promise: Promise<unknown>, status: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  // A redirect (an invalid link) is thrown by the router of the library, not by APIError itself.
  expect(error).toMatchObject({ status });
}

async function storedLinks() {
  return db.select().from(verifications);
}

async function addSend(email: string, minutesAgo: number) {
  await db.insert(loginEmailSends).values({
    email,
    linkIdentifier: `magic-link:old-${Math.random()}`,
    sentAt: new Date(Date.now() - minutesAgo * MINUTE),
  });
}

beforeEach(async () => {
  await resetDatabase();
  sendMail.mockReset();
  sendMail.mockResolvedValue(undefined);
});

describe("sending a login link", () => {
  it("sends the letter with a link to the normalized address", async () => {
    await requestLink("  Anna@Example.COM ");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [to, url] = sendMail.mock.calls[0];
    expect(to).toBe("anna@example.com");
    expect(url).toMatch(/^http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?token=/);
  });

  it("answers the same for a new address and for a known one", async () => {
    await addUser("known@example.com");

    const forNew = await requestLink("new@example.com");
    const forKnown = await requestLink("known@example.com");

    expect(forNew).toEqual({ status: true });
    expect(forKnown).toEqual(forNew);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("does not send anything for an invalid address even when the request is not from the form", async () => {
    await expectRejectedWith(requestLink("anna@"), "BAD_REQUEST");
    await expectRejectedWith(requestLink(""), "BAD_REQUEST");
    await expectRejectedWith(requestLink("   "), "BAD_REQUEST");

    expect(sendMail).not.toHaveBeenCalled();
    expect(await storedLinks()).toEqual([]);
    expect(await db.select().from(loginEmailSends)).toEqual([]);
  });

  it("does not store the token itself, only its hash", async () => {
    await requestLink("anna@example.com");

    const [link] = await storedLinks();
    expect(link.identifier).not.toContain(sentTokens()[0]);
  });
});

describe("logging in by the link", () => {
  it("lets the user in once and creates the user at the first login", async () => {
    await requestLink("anna@example.com");

    const result = await openLink(sentTokens()[0]);

    expect(result.user.email).toBe("anna@example.com");
    expect(await db.select().from(users)).toHaveLength(1);
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("does not open the same link twice", async () => {
    await requestLink("anna@example.com");
    const [token] = sentTokens();
    await openLink(token);

    await expectRejectedWith(openLink(token), "FOUND");
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("does not open a link after 15 minutes", async () => {
    await requestLink("anna@example.com");
    const [token] = sentTokens();

    await db.execute(sql`update verifications set expires_at = now() - interval '1 minute'`);

    await expectRejectedWith(openLink(token), "FOUND");
    expect(await db.select().from(users)).toEqual([]);
  });

  it("makes the link live 15 minutes", async () => {
    await requestLink("anna@example.com");

    const [link] = await storedLinks();
    const lifetime = link.expiresAt.getTime() - link.createdAt.getTime();
    expect(lifetime).toBeGreaterThan(14 * MINUTE);
    expect(lifetime).toBeLessThanOrEqual(15 * MINUTE + 1000);
  });

  it("does not open a link with a changed token", async () => {
    await requestLink("anna@example.com");
    const [token] = sentTokens();

    await expectRejectedWith(openLink(`${token.slice(0, -1)}x`), "FOUND");
    await expectRejectedWith(openLink(token.slice(0, 10)), "FOUND");
  });

  it("keeps a session for 30 days", async () => {
    await requestLink("anna@example.com");
    await openLink(sentTokens()[0]);

    const [session] = await db.select().from(sessions);
    const days = (session.expiresAt.getTime() - session.createdAt.getTime()) / (24 * 60 * MINUTE);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30.01);
  });
});

describe("a new link cancels the old ones", () => {
  it("makes the first link stop working when the second one is requested", async () => {
    await requestLink("anna@example.com");
    await requestLink("anna@example.com");
    const [first, second] = sentTokens();

    await expectRejectedWith(openLink(first), "FOUND");
    await expect(openLink(second)).resolves.toMatchObject({ user: { email: "anna@example.com" } });
  });

  it("leaves the links of other addresses alone", async () => {
    await requestLink("anna@example.com");
    await requestLink("boris@example.com");
    const [anna] = sentTokens();

    await expect(openLink(anna)).resolves.toBeDefined();
  });
});

describe("the limit of letters per address", () => {
  it("does not send the fourth letter in 10 minutes", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");

    await expectRejectedWith(requestLink("anna@example.com"), "TOO_MANY_REQUESTS");

    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it("keeps the third link alive and leaves no link for the refused request", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");
    await expectRejectedWith(requestLink("anna@example.com"), "TOO_MANY_REQUESTS");

    expect(await storedLinks()).toHaveLength(1);
    await expect(openLink(sentTokens()[2])).resolves.toBeDefined();
  });

  it("does not count letters that are older than 10 minutes", async () => {
    await addSend("anna@example.com", 11);
    await addSend("anna@example.com", 12);
    await addSend("anna@example.com", 20);

    await expect(requestLink("anna@example.com")).resolves.toEqual({ status: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("counts a letter that is younger than 10 minutes", async () => {
    await addSend("anna@example.com", 9);
    await addSend("anna@example.com", 9);
    await addSend("anna@example.com", 1);

    await expectRejectedWith(requestLink("anna@example.com"), "TOO_MANY_REQUESTS");
  });

  it("lets the user ask again once the first of three letters is 10 minutes old", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");
    await expectRejectedWith(requestLink("anna@example.com"), "TOO_MANY_REQUESTS");

    await db.execute(sql`update login_email_sends set sent_at = now() - interval '11 minutes'`);

    await expect(requestLink("anna@example.com")).resolves.toEqual({ status: true });
  });

  it("does not tell letter case apart", async () => {
    await requestLink("anna@example.com");
    await requestLink("Anna@Example.com");
    await requestLink(" ANNA@example.com");

    await expectRejectedWith(requestLink("anna@example.com"), "TOO_MANY_REQUESTS");
  });

  it("does not limit another address", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");

    await expect(requestLink("boris@example.com")).resolves.toEqual({ status: true });
    expect(sendMail).toHaveBeenLastCalledWith("boris@example.com", expect.any(String));
  });

  it("holds the limit when many requests come at once", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => requestLink("anna@example.com")),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it("leaves exactly one working link, from a letter that was sent, after requests at once", async () => {
    await Promise.allSettled(Array.from({ length: 8 }, () => requestLink("anna@example.com")));

    const links = await storedLinks();
    expect(links).toHaveLength(1);
    // The link that works is the one of the letter that was sent last by creation time.
    const working = await Promise.allSettled(sentTokens().map((token) => openLink(token)));
    expect(working.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("forgets letters older than a day", async () => {
    await addSend("anna@example.com", 2 * 24 * 60);

    await requestLink("anna@example.com");

    const rows = await db
      .select()
      .from(loginEmailSends)
      .where(eq(loginEmailSends.email, "anna@example.com"));
    expect(rows).toHaveLength(1);
  });
});

describe("when the letter cannot be sent", () => {
  it("fails, does not count the letter and keeps the older links alive", async () => {
    await requestLink("anna@example.com");
    const [first] = sentTokens();
    sendMail.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await expect(requestLink("anna@example.com")).rejects.toBeInstanceOf(APIError);

    expect(await db.select().from(loginEmailSends)).toHaveLength(1);
    expect(await storedLinks()).toHaveLength(1);
    await expect(openLink(first)).resolves.toBeDefined();
  });

  it("does not use up the limit with failed letters", async () => {
    sendMail.mockRejectedValue(new Error("connect ECONNREFUSED"));
    for (let i = 0; i < 5; i++) {
      await expect(requestLink("anna@example.com")).rejects.toBeInstanceOf(APIError);
    }

    sendMail.mockResolvedValue(undefined);
    await expect(requestLink("anna@example.com")).resolves.toEqual({ status: true });
  });
});
