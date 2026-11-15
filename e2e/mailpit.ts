import { expect, type Page } from "@playwright/test";
import { clearLoginState, E2E_USER } from "./database";

// Mailpit is the mail stub from compose.yaml: the app sends its letters there (SMTP_URL in
// playwright.config.ts), and the tests read them through its API.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

type MessageSummary = { ID: string; Created: string; Subject: string };
export type Letter = {
  id: string;
  subject: string;
  from: { name: string; address: string };
  to: string[];
  html: string;
  text: string;
};

async function mailpit(path: string, init?: RequestInit) {
  const response = await fetch(`${MAILPIT_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${init?.method ?? "GET"} ${path} answered ${response.status}`);
  }
  return response;
}

/** Deletes every letter in the mailbox. */
export async function clearMailbox() {
  await mailpit("/api/v1/messages", { method: "DELETE" });
}

/** The letters to the address, the newest first. */
export async function lettersTo(email: string): Promise<Letter[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const found = (await (await mailpit(`/api/v1/search?query=${query}`)).json()) as {
    messages: MessageSummary[] | null;
  };

  return Promise.all(
    (found.messages ?? []).map(async ({ ID }) => {
      const message = (await (await mailpit(`/api/v1/message/${ID}`)).json()) as {
        Subject: string;
        From: { Name: string; Address: string };
        To: { Address: string }[];
        HTML: string;
        Text: string;
      };
      return {
        id: ID,
        subject: message.Subject,
        from: { name: message.From.Name, address: message.From.Address },
        to: message.To.map((recipient) => recipient.Address),
        html: message.HTML,
        text: message.Text,
      };
    }),
  );
}

/** Waits until a letter to the address is in the mailbox; returns the newest one. */
export async function waitForLetter(email: string): Promise<Letter> {
  let newest: Letter | undefined;
  await expect
    .poll(async () => (newest = (await lettersTo(email))[0]), {
      message: `a letter to ${email} in Mailpit`,
      timeout: 15_000,
    })
    .toBeDefined();
  return newest!;
}

/** The login link of a letter, from its plain text version. */
export function linkOf(letter: Letter): string {
  const link = letter.text.match(/https?:\/\/\S*magic-link\/verify\S*/)?.[0];
  if (!link) {
    throw new Error(`No login link in the letter:\n${letter.text}`);
  }
  return link;
}

/** A made-up client address, so every login has its own bucket in the limit of the library by IP. */
export function randomClientIp() {
  const octet = () => 1 + Math.floor(Math.random() * 253);
  return `10.${octet()}.${octet()}.${octet()}`;
}

/**
 * Logs in like a person: asks for a link on the login page, takes it from the letter and opens it.
 * Starts from a clean mailbox and a clean record of sent letters, so the limit of three letters
 * does not depend on the tests that ran before. Leaves the page on the home page.
 */
export async function signIn(page: Page, email: string = E2E_USER) {
  await clearMailbox();
  await clearLoginState();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });

  await page.goto("/login");
  await page.getByLabel("Почта", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(page.getByText("Ссылка для входа отправлена на")).toBeVisible();

  await page.goto(linkOf(await waitForLetter(email)));
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Контакты" })).toBeVisible();
}
