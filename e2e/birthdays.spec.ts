import { expect, test, type Page } from "@playwright/test";
import { seedContacts } from "./database";
import { signIn } from "./mailpit";

// The main user paths of openspec/specs/birthdays/spec.md.
// Parsing and the window of days are covered by the unit tests; here the form, the card and the block.

// Without a login the app does not open, so every scenario starts logged in.
test.beforeEach(({ page }) => signIn(page));

const FORMAT_ERROR = "Введите дату как 14.03 или 14.03.1990";

// Next.js keeps the previous page in the DOM, hidden, so text must be looked up among visible elements.
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

function detailLine(page: Page, label: string) {
  return page
    .locator("dt", { hasText: label })
    .filter({ visible: true })
    .locator("xpath=following-sibling::dd");
}

/** The field of the form that is on screen: Next.js keeps a visited form in the page, hidden. */
const birthdayField = (page: Page) => page.getByLabel("День рождения").filter({ visible: true });

const birthdayLine = (page: Page) => detailLine(page, "День рождения");

/** Opens the card of a contact from the list of the home page. */
async function openCard(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Adds a contact through the form; `birthday` is typed into the field as it is. */
async function addContact(page: Page, name: string, birthday?: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  if (birthday !== undefined) {
    await page.getByLabel("День рождения").fill(birthday);
  }
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
}

async function openEditForm(page: Page, name: string) {
  await openCard(page, name);
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
}

test.describe("birthday in the card", () => {
  test("with a year", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: { day: 14, month: 3, year: 1990 } }]);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("14 марта 1990 г.");
  });

  test("without a year", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: { day: 14, month: 3 } }]);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("14 марта");
  });

  test("not set", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова" }]);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("не указано");
  });
});

test.describe("birthday in the form", () => {
  test.beforeEach(() => seedContacts([]));

  test("add a contact with a day, a month and a year", async ({ page }) => {
    await addContact(page, "Анна Смирнова", "14.03.1990");
    await expect(page).toHaveURL(/\?added=/);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("14 марта 1990 г.");
  });

  test("add a contact without a year", async ({ page }) => {
    await addContact(page, "Анна Смирнова", "14.03");
    await expect(page).toHaveURL(/\?added=/);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("14 марта");
  });

  test("add a contact without a birthday", async ({ page }) => {
    await addContact(page, "Анна Смирнова");
    await expect(page).toHaveURL(/\?added=/);

    await openCard(page, "Анна Смирнова");

    await expect(birthdayLine(page)).toHaveText("не указано");
  });

  test("a short entry is saved and shown in full when editing", async ({ page }) => {
    await addContact(page, "Анна Смирнова", " 5.3.1990 ");
    await expect(page).toHaveURL(/\?added=/);

    await openCard(page, "Анна Смирнова");
    await expect(birthdayLine(page)).toHaveText("5 марта 1990 г.");
    await page.getByRole("link", { name: "Изменить" }).click();

    await expect(page.getByLabel("День рождения")).toHaveValue("05.03.1990");
  });

  test("the edit form opens with the saved birthday", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: { day: 14, month: 3, year: 1990 } }]);

    await openEditForm(page, "Анна Смирнова");

    await expect(page.getByLabel("День рождения")).toHaveValue("14.03.1990");
  });

  test("change the birthday", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: { day: 14, month: 3 } }]);

    await openEditForm(page, "Анна Смирнова");
    await page.getByLabel("День рождения").fill("15.03.1990");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();

    await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
    await expect(birthdayLine(page)).toHaveText("15 марта 1990 г.");
  });

  test("remove the birthday", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: { day: 14, month: 3, year: 1990 } }]);

    await openEditForm(page, "Анна Смирнова");
    await page.getByLabel("День рождения").fill("");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();

    await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
    await expect(birthdayLine(page)).toHaveText("не указано");
  });

  test("February 29 is accepted without a year and with a leap year", async ({ page }) => {
    await addContact(page, "Анна Смирнова", "29.02");
    await expect(page).toHaveURL(/\?added=/);
    await addContact(page, "Борис Петров", "29.02.2000");
    await expect(page).toHaveURL(/\?added=/);

    await openCard(page, "Анна Смирнова");
    await expect(birthdayLine(page)).toHaveText("29 февраля");
    await openCard(page, "Борис Петров");
    await expect(birthdayLine(page)).toHaveText("29 февраля 2000 г.");
  });

  const wrongDates = [
    { name: "a wrong format", value: "март", message: FORMAT_ERROR },
    { name: "a date that does not exist", value: "31.02", message: FORMAT_ERROR },
    {
      name: "a year in the future",
      value: `14.03.${new Date().getFullYear() + 1}`,
      message: "Год не может быть в будущем",
    },
    { name: "a year before 1900", value: "14.03.1899", message: "Год не раньше 1900" },
    {
      name: "February 29 in a year that was not a leap year",
      value: "29.02.2001",
      message: FORMAT_ERROR,
    },
  ];

  for (const { name, value, message } of wrongDates) {
    test(`rejects ${name}`, async ({ page }) => {
      await addContact(page, "Анна Смирнова", value);

      // The contact is not saved, what was typed stays in the field, the reason is next to it.
      await expect(page).toHaveURL(/\/contacts\/new$/);
      await expect(page.getByLabel("День рождения")).toHaveValue(value);
      await expect(visibleText(page, message)).toBeVisible();
      await page.goto("/");
      await expect(visibleText(page, "Пока нет ни одного контакта.")).toBeVisible();
    });
  }
});

test("a contact added before the function has no birthday", async ({ page }) => {
  // The seed helper writes no birthday, as the migration leaves the existing contacts.
  await seedContacts([{ name: "Анна Смирнова" }]);

  await openCard(page, "Анна Смирнова");

  await expect(birthdayLine(page)).toHaveText("не указано");
});

// The block "Скоро день рождения" of the home page. Days are counted from today,
// so the scenarios hold on any date the tests run.

/** A birthday that falls `days` days from today. */
function inDays(days: number, year?: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return { day: date.getDate(), month: date.getMonth() + 1, year };
}

/** The date `days` days from today as the block writes it: "25 ноября". */
function dateLabel(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** The age that a person born in `birthYear` turns `days` days from today. */
function turning(days: number, birthYear: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.getFullYear() - birthYear;
}

/** A birthday far from the window, so it never shows in the block. */
const FAR = () => inDays(100);

/** The text of a birthday as it is typed into the field: "05.03" or "05.03.1990". */
function formatForField({ day, month, year }: { day: number; month: number; year?: number }) {
  const dayAndMonth = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
  return year === undefined ? dayAndMonth : `${dayAndMonth}.${year}`;
}

function block(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

function blockRows(page: Page) {
  return block(page).getByRole("listitem");
}

function blockRow(page: Page, name: string) {
  return blockRows(page).filter({ hasText: name });
}

function listRows(page: Page) {
  return page.locator('li[id^="contact-"]');
}

function searchBox(page: Page) {
  return page.getByRole("searchbox", { name: "Поиск по имени" });
}

function selectGroup(page: Page, name: string) {
  return page
    .getByRole("navigation", { name: "Фильтр по группе" })
    .getByRole("link", { name, exact: true })
    .click();
}

const showAll = (page: Page, total: number) =>
  page.getByRole("button", { name: `Показать всех · ${total}` });

const collapse = (page: Page) => page.getByRole("button", { name: "Свернуть" });

/** `count` contacts with birthdays in the window, named so that their order is easy to check. */
const manyBirthdays = (count: number, group?: string, prefix = "Контакт") =>
  Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${String(index + 1).padStart(2, "0")}`,
    birthday: inDays(index % 8),
    group,
  }));

test.describe("the block of soon birthdays", () => {
  test("shows the contacts with a birthday in the window, under the group buttons", async ({
    page,
  }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(1) },
      { name: "Борис", birthday: inDays(3, 1990) },
      { name: "Вера", birthday: inDays(7) },
      // Outside the window, and with no birthday at all.
      { name: "Глеб", birthday: inDays(8) },
      { name: "Дарья", birthday: inDays(-1) },
      { name: "Егор", birthday: FAR() },
      { name: "Жанна" },
    ]);

    await page.goto("/");

    await expect(block(page).getByText("3 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Борис/, /Вера/]);
    const groupsLink = await page.getByRole("link", { name: "Настроить группы" }).boundingBox();
    const blockBox = await block(page).boundingBox();
    expect(groupsLink!.y).toBeLessThan(blockBox!.y);
  });

  test("is not on the page when nobody has a soon birthday", async ({ page }) => {
    await seedContacts([{ name: "Анна", birthday: FAR() }, { name: "Борис" }]);

    await page.goto("/");

    await expect(visibleText(page, "Всего 2 контакта")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });

  test("stays the same while searching, and only the common list is filtered", async ({ page }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(1) },
      { name: "Иван", birthday: inDays(2) },
      { name: "Глеб" },
    ]);

    await page.goto("/");
    await searchBox(page).fill("Глеб");

    await expect(listRows(page)).toHaveCount(1);
    await expect(listRows(page)).toContainText("Глеб");
    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Иван/]);
  });

  test("shows a birthday set a moment ago, and drops one that was removed", async ({ page }) => {
    await seedContacts([{ name: "Анна" }, { name: "Борис", birthday: inDays(2) }]);
    await page.goto("/");
    await expect(blockRows(page)).toHaveText([/Борис/]);

    // Set a birthday for Анна.
    await listRows(page).filter({ hasText: "Анна" }).getByRole("link").click();
    await page.getByRole("link", { name: "Изменить" }).click();
    await birthdayField(page).fill(formatForField(inDays(1)));
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
    await page.getByRole("link", { name: "Все контакты" }).click();

    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Борис/]);

    // Remove it again.
    await listRows(page).filter({ hasText: "Анна" }).getByRole("link").click();
    await page.getByRole("link", { name: "Изменить" }).click();
    await birthdayField(page).fill("");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
    await page.getByRole("link", { name: "Все контакты" }).click();

    await expect(block(page).getByText("1 контакт")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Борис/]);
  });

  test("a deleted contact leaves the block", async ({ page }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(1) },
      { name: "Иван", birthday: inDays(2) },
    ]);

    await page.goto("/");
    await blockRow(page, "Анна").getByRole("link").click();
    await page.getByRole("button", { name: "Удалить" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();

    await expect(visibleText(page, "Контакт удалён")).toBeVisible();
    await expect(block(page).getByText("1 контакт")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Иван/]);
  });

  test("a group narrows the block and its number", async ({ page }) => {
    await seedContacts([
      ...manyBirthdays(2, "Теннис", "Теннисист"),
      ...manyBirthdays(4, "Семья", "Родственник"),
    ]);

    await page.goto("/");
    await expect(block(page).getByText("6 контактов")).toBeVisible();
    await selectGroup(page, "Теннис");

    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveCount(2);
    await expect(blockRows(page).first()).toContainText("Теннисист");
  });

  test("is not on the page when nobody in the group has a soon birthday", async ({ page }) => {
    await seedContacts([
      { name: "Анна", group: "Теннис" },
      { name: "Борис", birthday: inDays(2), group: "Семья" },
    ]);

    await page.goto("/");
    await expect(block(page)).toBeVisible();
    await selectGroup(page, "Теннис");

    await expect(visibleText(page, "В группе «Теннис»: 1 контакт")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });

  test("keeps the contacts of the group while searching inside it", async ({ page }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(1), group: "Теннис" },
      { name: "Иван", birthday: inDays(2), group: "Теннис" },
      { name: "Глеб", group: "Теннис" },
    ]);

    await page.goto("/");
    await selectGroup(page, "Теннис");
    await searchBox(page).fill("Глеб");

    await expect(listRows(page)).toHaveCount(1);
    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Иван/]);
  });

  test("stands above «Пора связаться»", async ({ page }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(1) },
      {
        name: "Борис",
        frequency: "week",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    ]);

    await page.goto("/");

    const keepInTouch = page.getByRole("region", { name: "Пора связаться" });
    await expect(keepInTouch).toBeVisible();
    await expect(block(page)).toBeVisible();
    const birthdaysBox = await block(page).boundingBox();
    const keepInTouchBox = await keepInTouch.boundingBox();
    expect(birthdaysBox!.y).toBeLessThan(keepInTouchBox!.y);
  });

  test("puts the nearest birthday first, the same day by name", async ({ page }) => {
    await seedContacts([
      { name: "Анна", birthday: inDays(3) },
      { name: "Иван", birthday: inDays(0) },
      { name: "Ольга", birthday: inDays(1) },
      { name: "Яна", birthday: inDays(5) },
      { name: "Борис", birthday: inDays(5) },
    ]);

    await page.goto("/");

    await expect(blockRows(page)).toHaveText([/Иван/, /Ольга/, /Анна/, /Борис/, /Яна/]);
  });

  test("writes in the row when, the date and the age", async ({ page }) => {
    await seedContacts([
      { name: "Иван", birthday: inDays(0, 1990) },
      { name: "Ольга", birthday: inDays(1) },
      { name: "Анна", birthday: inDays(3) },
      { name: "Борис", birthday: inDays(5) },
    ]);

    await page.goto("/");

    await expect(blockRow(page, "Иван")).toContainText(
      `сегодня · ${dateLabel(0)} · исполняется ${turning(0, 1990)}`,
    );
    await expect(blockRow(page, "Ольга")).toContainText(`завтра · ${dateLabel(1)}`);
    await expect(blockRow(page, "Ольга")).not.toContainText("исполняется");
    await expect(blockRow(page, "Анна")).toContainText(`через 3 дня · ${dateLabel(3)}`);
    await expect(blockRow(page, "Борис")).toContainText(`через 5 дней · ${dateLabel(5)}`);
  });

  test("opens the card from a row", async ({ page }) => {
    await seedContacts([{ name: "Анна Смирнова", birthday: inDays(2) }]);

    await page.goto("/");
    await blockRow(page, "Анна Смирнова").getByRole("link").click();

    await expect(page.getByRole("heading", { level: 1, name: "Анна Смирнова" })).toBeVisible();
  });

  test("has no contact whose birthday was never set", async ({ page }) => {
    // Contacts that were there before the function have no birthday.
    await seedContacts([{ name: "Анна" }, { name: "Борис" }]);

    await page.goto("/");

    await expect(visibleText(page, "Всего 2 контакта")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });

  test("with more than five shows five and «Показать всех»", async ({ page }) => {
    await seedContacts(manyBirthdays(8));

    await page.goto("/");

    await expect(block(page).getByText("8 контактов")).toBeVisible();
    await expect(blockRows(page)).toHaveCount(5);
    await expect(showAll(page, 8)).toBeVisible();
    await expect(collapse(page)).toHaveCount(0);
  });

  test("opens all of them and collapses back", async ({ page }) => {
    await seedContacts(manyBirthdays(8));

    await page.goto("/");
    await showAll(page, 8).click();

    await expect(blockRows(page)).toHaveCount(8);
    await expect(collapse(page)).toBeVisible();
    await expect(showAll(page, 8)).toHaveCount(0);

    await collapse(page).click();

    await expect(blockRows(page)).toHaveCount(5);
    await expect(showAll(page, 8)).toBeVisible();
  });

  test("with five or fewer has no buttons", async ({ page }) => {
    await seedContacts(manyBirthdays(4));

    await page.goto("/");

    await expect(blockRows(page)).toHaveCount(4);
    await expect(showAll(page, 4)).toHaveCount(0);
    await expect(collapse(page)).toHaveCount(0);
  });

  test("a change of the group collapses the block", async ({ page }) => {
    await seedContacts([
      ...manyBirthdays(8, "Теннис", "Теннисист"),
      ...manyBirthdays(7, "Семья", "Родственник"),
    ]);

    await page.goto("/");
    await showAll(page, 15).click();
    await expect(blockRows(page)).toHaveCount(15);
    await selectGroup(page, "Семья");

    await expect(blockRows(page)).toHaveCount(5);
    await expect(showAll(page, 7)).toBeVisible();
  });
});
