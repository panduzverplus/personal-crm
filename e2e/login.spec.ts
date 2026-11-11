import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  addContactFor,
  addGroupFor,
  ageLoginLinks,
  ageSentLetters,
  ageSessions,
  resetEverything,
  sessionsOf,
  userCount,
} from "./database";
import { clearMailbox, lettersTo, linkOf, randomClientIp, signIn, waitForLetter } from "./mailpit";

// Login by a link from an email: openspec/changes/login/specs/user-auth and data-ownership.
// Letters are read from Mailpit; time (15 minutes, 10 minutes, 30 days) is moved in the database.

const ANNA = "anna@example.com";
const BORIS = "boris@example.com";

// Next.js keeps the previous page in the DOM, hidden, so text must be looked up among visible elements.
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

test.beforeEach(async ({ page }) => {
  await resetEverything();
  await clearMailbox();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomClientIp() });
});

/** Another person's (or another device's) browser: its own cookies and its own client address. */
async function newBrowser(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomClientIp() },
  });
  return { context, page: await context.newPage() };
}

async function askForLink(page: Page, email: string) {
  await page.goto("/login");
  await submitEmail(page, email);
}

async function submitEmail(page: Page, email: string) {
  await page.getByLabel("Почта", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

/** Waits until Mailpit has this many letters to the address (a letter is sent a moment after the click). */
async function expectLetterCount(email: string, count: number) {
  await expect.poll(async () => (await lettersTo(email)).length).toBe(count);
}

async function linksTo(email: string) {
  // The newest first, as Mailpit returns them.
  return (await lettersTo(email)).map((letter) => linkOf(letter));
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function addContactViaForm(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\?added=\d+/);
  return Number(new URL(page.url()).searchParams.get("added"));
}

function expectLoggedInAs(page: Page, email: string) {
  return expect(page.getByRole("banner").getByText(email)).toBeVisible();
}

// --- The main scenario of the feature: two people do not see each other ---

test("two people log in and do not see each other's data", async ({ page, browser }) => {
  const anna = page;
  const boris = await newBrowser(browser);
  let annaCardAddress = "";
  let annaGroupId = 0;

  await test.step("Anna logs in, adds a contact and has a group", async () => {
    await signIn(anna, ANNA);
    const contactId = await addContactViaForm(anna, "Анна Смирнова");
    annaCardAddress = `/contacts/${contactId}`;
    annaGroupId = await addGroupFor(ANNA, "Теннис");
    await anna.goto("/");
    await expect(visibleText(anna, "Всего 1 контакт")).toBeVisible();
  });

  await test.step("Boris logs in and sees an empty list without groups", async () => {
    await signIn(boris.page, BORIS);

    await expect(visibleText(boris.page, "Пока нет ни одного контакта.")).toBeVisible();
    await expect(boris.page.getByRole("link", { name: "Добавить первый контакт" })).toBeVisible();
    const filter = boris.page.getByRole("navigation", { name: "Фильтр по группе" });
    await expect(filter.getByRole("link")).toHaveText(["Все", "Настроить группы"]);
    await expect(filter.getByRole("link", { name: "Теннис" })).toHaveCount(0);
  });

  await test.step("Anna's contact is not in Boris's list or search", async () => {
    await addContactViaForm(boris.page, "Борис Петров");
    const search = boris.page.getByRole("searchbox", { name: "Поиск по имени" });
    await search.fill("Анна");
    await search.press("Enter");

    await expect(visibleText(boris.page, "По запросу «Анна» никого не нашлось.")).toBeVisible();
    await expect(visibleText(boris.page, "Анна Смирнова")).toHaveCount(0);
    await expect(visibleText(boris.page, "Найдено: 0 контактов из 1")).toBeVisible();
  });

  await test.step("her card and her edit page are 'not found' for Boris", async () => {
    await boris.page.goto(annaCardAddress);
    await expect(visibleText(boris.page, "Контакт не найден")).toBeVisible();
    await expect(visibleText(boris.page, "Анна Смирнова")).toHaveCount(0);

    await boris.page.goto(`${annaCardAddress}/edit`);
    await expect(visibleText(boris.page, "Контакт не найден")).toBeVisible();
  });

  await test.step("Anna's group in the address opens 'Все' for Boris without an error", async () => {
    await boris.page.goto(`/?group=${annaGroupId}`);

    const all = boris.page
      .getByRole("navigation", { name: "Фильтр по группе" })
      .getByRole("link", { name: "Все" });
    await expect(all).toHaveAttribute("aria-current", "true");
    await expect(visibleText(boris.page, "Всего 1 контакт")).toBeVisible();
    await expect(visibleText(boris.page, "Борис Петров")).toBeVisible();
  });

  await test.step("Anna still has her contact", async () => {
    await anna.goto(annaCardAddress);
    await expect(anna.getByRole("heading", { level: 1, name: "Анна Смирнова" })).toBeVisible();
  });

  await boris.context.close();
});

// --- The app is closed without a login ---

test.describe("without a login", () => {
  test("the home page and a contact card lead to the login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Почта", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();

    const id = await addContactFor(ANNA, "Анна Смирнова");
    await page.goto(`/contacts/${id}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(visibleText(page, "Анна Смирнова")).toHaveCount(0);
  });

  test("a request to save something is turned away and saves nothing", async ({ request }) => {
    await addGroupFor(ANNA, "Теннис");

    const response = await request.post("/contacts/new", {
      headers: { "next-action": "00".repeat(21), "content-type": "text/plain;charset=UTF-8" },
      data: "[]",
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, "http://localhost").pathname).toBe("/login");
  });

  test("/health stays open", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("a logged-in person who opens the login page gets the home page", async ({ page }) => {
    await signIn(page, ANNA);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Контакты" })).toBeVisible();
  });
});

// --- Asking for a link ---

test.describe("asking for a link", () => {
  test("shows the address the letter went to, and the letter comes", async ({ page }) => {
    await askForLink(page, ANNA);

    await expect(visibleText(page, `Ссылка для входа отправлена на ${ANNA}`)).toBeVisible();
    await expectLetterCount(ANNA, 1);
    // The form stays under the message, so the link can be asked for again.
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
  });

  test("says the same for a new and for a known address", async ({ page }) => {
    await addContactFor(ANNA, "Кто-то");

    await askForLink(page, ANNA);
    await expect(visibleText(page, `Ссылка для входа отправлена на ${ANNA}`)).toBeVisible();
    await submitEmail(page, BORIS);
    await expect(visibleText(page, `Ссылка для входа отправлена на ${BORIS}`)).toBeVisible();

    await expectLetterCount(ANNA, 1);
    await expectLetterCount(BORIS, 1);
  });

  test.describe("a wrong address", () => {
    for (const typed of ["anna@", ""]) {
      test(`${JSON.stringify(typed)} is refused under the field and sends nothing`, async ({
        page,
      }) => {
        await askForLink(page, typed);

        await expect(visibleText(page, "Проверь адрес почты")).toBeVisible();
        await expect(page.getByLabel("Почта", { exact: true })).toHaveAttribute(
          "aria-invalid",
          "true",
        );
        await expect(visibleText(page, "Ссылка для входа отправлена")).toHaveCount(0);
        // Nothing arrives, however long it is awaited: check twice with a pause.
        await page.waitForTimeout(500);
        expect(await allLetterCount()).toBe(0);
      });
    }
  });

  test("spaces and capital letters give the same person", async ({ page }) => {
    await signIn(page, ANNA);
    await addContactViaForm(page, "Анна Смирнова");
    await signOut(page);

    await submitEmail(page, "  Anna@Example.COM ");

    await expect(visibleText(page, `Ссылка для входа отправлена на ${ANNA}`)).toBeVisible();
    await page.goto(linkOf(await waitForLetter(ANNA)));
    await expectLoggedInAs(page, ANNA);
    await expect(visibleText(page, "Анна Смирнова")).toBeVisible();
    expect(await userCount()).toBe(1);
  });
});

async function allLetterCount() {
  const response = await fetch(
    `${process.env.MAILPIT_URL ?? "http://127.0.0.1:8025"}/api/v1/messages`,
  );
  return ((await response.json()) as { messages_count: number }).messages_count;
}

// --- Logging in by the link ---

test.describe("logging in by the link", () => {
  test("the first login creates the person: home page, the address in the header", async ({
    page,
  }) => {
    expect(await userCount()).toBe(0);

    await signIn(page, ANNA);

    await expectLoggedInAs(page, ANNA);
    expect(await userCount()).toBe(1);
    await expect(visibleText(page, "Пока нет ни одного контакта.")).toBeVisible();
  });

  test("a repeated login shows the earlier contacts and creates nobody new", async ({ page }) => {
    await signIn(page, ANNA);
    await addContactViaForm(page, "Анна Смирнова");
    await signOut(page);

    await signIn(page, ANNA);

    await expect(visibleText(page, "Анна Смирнова")).toBeVisible();
    expect(await userCount()).toBe(1);
  });

  test("a link asked for on one device opens on another", async ({ page, browser }) => {
    await askForLink(page, ANNA);
    const link = linkOf(await waitForLetter(ANNA));

    const phone = await newBrowser(browser);
    await phone.page.goto(link);

    await expectLoggedInAs(phone.page, ANNA);
    // The first browser did not log in by this.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await phone.context.close();
  });

  test("the button 'Войти' in the letter logs in", async ({ page }) => {
    await askForLink(page, ANNA);
    const letter = await waitForLetter(ANNA);
    const link = letter.html.match(/<a href="([^"]+)"[^>]*>\s*Войти\s*<\/a>/)?.[1];
    expect(link).toBeDefined();

    await page.goto(link!.replaceAll("&amp;", "&"));

    await expectLoggedInAs(page, ANNA);
  });

  test("the letter has the sender, the subject, the button, the 15 minutes and the ignore line", async ({
    page,
  }) => {
    await askForLink(page, ANNA);

    const letter = await waitForLetter(ANNA);

    expect(letter.from).toEqual({
      name: "Личная CRM",
      address: "noreply@mail.crm.chigabugadaga.ru",
    });
    expect(letter.subject).toBe("Вход в Личную CRM");
    expect(letter.html).toMatch(/>\s*Войти\s*<\/a>/);
    expect(letter.text).toContain("15 минут");
    expect(letter.html).toContain("15 минут");
    for (const body of [letter.text, letter.html]) {
      expect(body).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    }
  });
});

// --- Life of a link ---

test.describe("a link that no longer works leads to 'Ссылка устарела'", () => {
  async function expectExpiredPage(page: Page) {
    await expect(page).toHaveURL(/\/login\/expired/);
    await expect(visibleText(page, "Ссылка устарела, запроси новую")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  }

  test("a link that was used once is not opened twice", async ({ page }) => {
    await askForLink(page, ANNA);
    const link = linkOf(await waitForLetter(ANNA));
    await page.goto(link);
    await expectLoggedInAs(page, ANNA);
    await signOut(page);

    await page.goto(link);

    await expectExpiredPage(page);
  });

  test("a link of 16 minutes ago", async ({ page }) => {
    await askForLink(page, ANNA);
    const link = linkOf(await waitForLetter(ANNA));
    await ageLoginLinks(16);

    await page.goto(link);

    await expectExpiredPage(page);
  });

  test("a link of 14 minutes ago still works", async ({ page }) => {
    await askForLink(page, ANNA);
    const link = linkOf(await waitForLetter(ANNA));
    await ageLoginLinks(14);

    await page.goto(link);

    await expectLoggedInAs(page, ANNA);
  });

  test("an older link stops working when a newer one is asked for, the newer one works", async ({
    page,
  }) => {
    await askForLink(page, ANNA);
    await expectLetterCount(ANNA, 1);
    await submitEmail(page, ANNA);
    await expectLetterCount(ANNA, 2);
    const [newer, older] = await linksTo(ANNA);

    await page.goto(older);
    await expectExpiredPage(page);

    await page.goto(newer);
    await expectLoggedInAs(page, ANNA);
  });

  test("a link with a changed or cut code", async ({ page }) => {
    await askForLink(page, ANNA);
    const link = linkOf(await waitForLetter(ANNA));

    await page.goto(
      link.replace(/token=([^&]+)/, (_, token: string) => `token=${token.slice(0, -2)}xx`),
    );
    await expectExpiredPage(page);

    await page.goto(
      link.replace(/token=([^&]+)/, (_, token: string) => `token=${token.slice(0, 8)}`),
    );
    await expectExpiredPage(page);
  });

  test("the button on the page leads to the login page", async ({ page }) => {
    await page.goto("/login/expired");

    await page.getByRole("link", { name: "Получить новую ссылку" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Почта", { exact: true })).toBeVisible();
  });
});

// --- The limit of letters ---

test.describe("the limit of three letters in ten minutes", () => {
  const LIMIT_MESSAGE = "Слишком часто, попробуй через несколько минут";

  async function sendThreeLetters(page: Page, email = ANNA) {
    await askForLink(page, email);
    await expectLetterCount(email, 1);
    await submitEmail(page, email);
    await expectLetterCount(email, 2);
    await submitEmail(page, email);
    await expectLetterCount(email, 3);
  }

  test("the fourth request is refused and no fourth letter comes", async ({ page }) => {
    await sendThreeLetters(page);

    await submitEmail(page, ANNA);

    await expect(visibleText(page, LIMIT_MESSAGE)).toBeVisible();
    await expect(visibleText(page, "Ссылка для входа отправлена")).toHaveCount(0);
    await page.waitForTimeout(500);
    await expectLetterCount(ANNA, 3);
  });

  test("the link of the third letter works after the limit", async ({ page }) => {
    await sendThreeLetters(page);
    await submitEmail(page, ANNA);
    await expect(visibleText(page, LIMIT_MESSAGE)).toBeVisible();
    const [third] = await linksTo(ANNA);

    await page.goto(third);

    await expectLoggedInAs(page, ANNA);
  });

  test("after ten minutes the link can be asked for again", async ({ page }) => {
    await sendThreeLetters(page);
    await submitEmail(page, ANNA);
    await expect(visibleText(page, LIMIT_MESSAGE)).toBeVisible();

    await ageSentLetters(11);
    await submitEmail(page, ANNA);

    await expect(visibleText(page, `Ссылка для входа отправлена на ${ANNA}`)).toBeVisible();
    await expectLetterCount(ANNA, 4);
  });

  test("another address is not limited", async ({ page }) => {
    await sendThreeLetters(page);

    await submitEmail(page, BORIS);

    await expect(visibleText(page, `Ссылка для входа отправлена на ${BORIS}`)).toBeVisible();
    await expectLetterCount(BORIS, 1);
  });

  test("capital letters and spaces do not help to get round the limit", async ({ page }) => {
    await askForLink(page, ANNA);
    await expectLetterCount(ANNA, 1);
    await submitEmail(page, "Anna@Example.com");
    await expectLetterCount(ANNA, 2);
    await submitEmail(page, " ANNA@example.com");
    await expectLetterCount(ANNA, 3);

    await submitEmail(page, ANNA);

    await expect(visibleText(page, LIMIT_MESSAGE)).toBeVisible();
  });
});

// --- The header and logging out ---

test.describe("the header", () => {
  test("shows the address and 'Выйти' after the login", async ({ page }) => {
    await signIn(page, ANNA);

    await expectLoggedInAs(page, ANNA);
    await expect(page.getByRole("banner").getByRole("button", { name: "Выйти" })).toBeVisible();
  });

  test("has only the logo on the login pages", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("banner").getByRole("button", { name: "Выйти" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link")).toHaveCount(1);

    await page.goto("/login/expired");
    await expect(page.getByRole("banner").getByRole("button", { name: "Выйти" })).toHaveCount(0);
  });

  test("'Выйти' opens the login page, and the home page leads there again", async ({ page }) => {
    await signIn(page, ANNA);

    await signOut(page);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect(await sessionsOf(ANNA)).toHaveLength(0);
  });

  test("'Выйти' ends the login only on this device", async ({ page, browser }) => {
    await signIn(page, ANNA);
    const phone = await newBrowser(browser);
    await signIn(phone.page, ANNA);
    await expectLoggedInAs(phone.page, ANNA);

    await signOut(page);

    await phone.page.goto("/");
    await expectLoggedInAs(phone.page, ANNA);
    expect(await sessionsOf(ANNA)).toHaveLength(1);
    await phone.context.close();
  });

  test("the header fits a phone screen with a long address", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const longAddress = `${"a".repeat(40)}@example-company.example.com`;

    await signIn(page, longAddress);

    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      screen: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.screen);
  });
});

// --- How long the login lasts ---

test.describe("how long a login lasts", () => {
  test("is still valid after 20 days", async ({ page }) => {
    await signIn(page, ANNA);

    await ageSessions(ANNA, 20);
    await page.goto("/");

    await expectLoggedInAs(page, ANNA);
  });

  test("a visit moves the end: 20 days, a visit, 20 days more", async ({ page }) => {
    await signIn(page, ANNA);

    await ageSessions(ANNA, 20);
    await page.goto("/");
    await expectLoggedInAs(page, ANNA);
    await ageSessions(ANNA, 20);
    await page.goto("/");

    await expectLoggedInAs(page, ANNA);
  });

  test("a visit renews the cookie in the browser too, not only the database", async ({
    page,
    context,
  }) => {
    await signIn(page, ANNA);
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name.endsWith("session_token"))!;
    const inFiveDays = Date.now() / 1000 + 5 * 24 * 60 * 60;
    await context.addCookies([{ ...session, expires: inFiveDays }]);

    await page.goto("/");

    const renewed = (await context.cookies()).find((cookie) =>
      cookie.name.endsWith("session_token"),
    )!;
    const days = (renewed.expires - Date.now() / 1000) / (24 * 60 * 60);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  test("is over after 31 days without a visit", async ({ page }) => {
    await signIn(page, ANNA);

    await ageSessions(ANNA, 31);
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Почта", { exact: true })).toBeVisible();
  });

  test("two devices are logged in at once", async ({ page, browser }) => {
    await signIn(page, ANNA);
    const phone = await newBrowser(browser);
    await signIn(phone.page, ANNA);

    await page.goto("/");
    await phone.page.goto("/");

    await expectLoggedInAs(page, ANNA);
    await expectLoggedInAs(phone.page, ANNA);
    expect(await sessionsOf(ANNA)).toHaveLength(2);
    await phone.context.close();
  });
});
