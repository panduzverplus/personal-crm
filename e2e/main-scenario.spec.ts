import { expect, test, type Page } from "@playwright/test";
import { resetContacts } from "./database";

// The main scenario and its success criteria from specs/01-продуктовая-идея.md.

const EXISTING_CONTACTS = ["Борис Петров", "Вера Соколова"];
const NEW_CONTACT = {
  name: "Анна Смирнова",
  about: "Дизайнер, подруга Саши",
  howWeMet: "Учились вместе в университете",
  phone: "+7 900 123-45-67",
  email: "anna@example.com",
};
const NOTE = "Договорились созвониться в пятницу";

// Next.js keeps the previous page in the DOM, hidden, so text must be looked up among visible elements.
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

function contactRow(page: Page, name: string) {
  return page.getByRole("listitem").filter({ hasText: name });
}

function savedNote(page: Page) {
  return page
    .getByRole("region", { name: "Заметки" })
    .getByRole("listitem")
    .filter({ hasText: NOTE });
}

async function expectAllContactsListed(page: Page) {
  for (const name of [...EXISTING_CONTACTS, NEW_CONTACT.name]) {
    await expect(contactRow(page, name)).toBeVisible();
  }
  await expect(visibleText(page, "Всего 3 контакта")).toBeVisible();
}

test.beforeEach(() => resetContacts(EXISTING_CONTACTS));

test("add a contact, find it by name, write a note, see the same data in another browser", async ({
  page,
  browser,
}) => {
  await test.step("opening the app shows all contacts", async () => {
    await page.goto("/");

    for (const name of EXISTING_CONTACTS) {
      await expect(contactRow(page, name)).toBeVisible();
    }
    await expect(visibleText(page, "Всего 2 контакта")).toBeVisible();
  });

  await test.step("an added contact appears in the list", async () => {
    await page.getByRole("link", { name: "Добавить контакт" }).click();
    await page.getByLabel("Имя").fill(NEW_CONTACT.name);
    await page.getByLabel("Кто это").fill(NEW_CONTACT.about);
    await page.getByLabel("Откуда знакомы").fill(NEW_CONTACT.howWeMet);
    await page.getByLabel("Телефон").fill(NEW_CONTACT.phone);
    await page.getByLabel("Почта").fill(NEW_CONTACT.email);
    await page.getByRole("button", { name: "Сохранить контакт" }).click();

    await expect(page).toHaveURL(/\?added=/);
    await expectAllContactsListed(page);
  });

  await test.step("the contact is found by name and its card opens", async () => {
    const search = page.getByRole("searchbox", { name: "Поиск по имени" });
    await search.fill("Смирнова");
    await search.press("Enter");

    await expect(visibleText(page, "Найдено: 1 контакт из 3")).toBeVisible();
    await expect(contactRow(page, NEW_CONTACT.name)).toBeVisible();
    for (const name of EXISTING_CONTACTS) {
      await expect(contactRow(page, name)).toHaveCount(0);
    }

    await contactRow(page, NEW_CONTACT.name).getByRole("link").click();

    await expect(
      page.getByRole("heading", { level: 1, name: NEW_CONTACT.name }),
    ).toBeVisible();
    await expect(visibleText(page, NEW_CONTACT.about)).toBeVisible();
    await expect(visibleText(page, NEW_CONTACT.howWeMet)).toBeVisible();
    await expect(visibleText(page, NEW_CONTACT.phone)).toBeVisible();
    await expect(visibleText(page, NEW_CONTACT.email)).toBeVisible();
  });

  await test.step("a note written in the card stays there after a reload", async () => {
    await page.getByLabel("Новая заметка").fill(NOTE);
    await page.getByRole("button", { name: "Добавить заметку" }).click();

    await expect(visibleText(page, "Заметка сохранена")).toBeVisible();
    await expect(savedNote(page)).toBeVisible();

    await page.reload();
    await expect(savedNote(page)).toBeVisible();
  });

  await test.step("another browser sees the same contacts and the note", async () => {
    const cardAddress = page.url();
    // A separate context shares no cookies or storage with the first one, like another browser.
    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();

      await otherPage.goto("/");
      await expectAllContactsListed(otherPage);

      await otherPage.goto(cardAddress);
      await expect(savedNote(otherPage)).toBeVisible();
    } finally {
      await otherContext.close();
    }
  });
});
