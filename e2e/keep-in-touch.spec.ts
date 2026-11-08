import { expect, test, type Page } from "@playwright/test";
import { seedContacts, type SeedContact } from "./database";

// The main user paths of openspec/specs/keep-in-touch/spec.md.
// Date arithmetic and note editing are covered by the unit tests.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

/** A contact with a weekly frequency whose due day passed `days` days ago. */
const overdue = (name: string, days: number, group?: string): SeedContact => ({
  name,
  frequency: "week",
  createdAt: daysAgo(days + 7),
  group,
});

/** `count` overdue contacts named so that their order in the block is easy to check. */
const manyOverdue = (count: number, groupOf?: (index: number) => string | undefined) =>
  Array.from({ length: count }, (_, index) =>
    overdue(`Контакт ${String(index + 1).padStart(2, "0")}`, 200 - index, groupOf?.(index)),
  );

const firstNames = (count: number) =>
  Array.from({ length: count }, (_, index) => `Контакт ${String(index + 1).padStart(2, "0")}`);

function block(page: Page) {
  return page.getByRole("region", { name: "Пора связаться" });
}

function blockRows(page: Page) {
  return block(page).getByRole("listitem");
}

function blockRow(page: Page, name: string) {
  return blockRows(page).filter({ hasText: name });
}

/** Rows of the common contact list, without the rows of the block. */
function listRows(page: Page) {
  return page.locator('li[id^="contact-"]');
}

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

const frequencyLine = (page: Page) => detailLine(page, "Как часто общаться");

function frequencyField(page: Page) {
  return page.getByLabel("Как часто общаться").filter({ visible: true });
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

async function addContact(page: Page, name: string, frequency?: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  if (frequency) {
    await frequencyField(page).selectOption({ label: frequency });
  }
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\?added=/);
}

async function openCardFromList(page: Page, name: string) {
  await listRows(page).filter({ hasText: name }).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function changeFrequency(page: Page, frequency: string) {
  await frequencyField(page).selectOption({ label: frequency });
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
}

test("set, change and remove the frequency of a contact", async ({ page }) => {
  await seedContacts([]);

  await test.step("a frequency chosen when adding shows in the card", async () => {
    await addContact(page, "Анна Смирнова", "Раз в месяц");
    await openCardFromList(page, "Анна Смирнова");

    await expect(frequencyLine(page)).toHaveText(/^Раз в месяц · связаться до .+ г\.$/);
  });

  await test.step("the edit form opens with the saved frequency, and it can be changed", async () => {
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(frequencyField(page)).toHaveValue("month");

    await changeFrequency(page, "Раз в неделю");

    await expect(frequencyLine(page)).toHaveText(/^Раз в неделю · связаться до .+ г\.$/);
  });

  await test.step("the frequency can be removed", async () => {
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(frequencyField(page)).toHaveValue("week");

    await changeFrequency(page, "Не задано");

    await expect(frequencyLine(page)).toHaveText("не указано");
  });

  await test.step("a contact added without touching the field has no frequency", async () => {
    await addContact(page, "Борис Петров");
    await openCardFromList(page, "Борис Петров");

    await expect(frequencyLine(page)).toHaveText("не указано");
  });
});

test("a reopened edit form shows the saved data and saving it keeps them", async ({ page }) => {
  await seedContacts([{ name: "Анна" }], ["Теннис"]);
  const nameField = () => page.getByLabel("Имя").filter({ visible: true });
  const groupBox = () => page.getByRole("checkbox", { name: "Теннис" });
  const save = async () => {
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(visibleText(page, "Изменения сохранены")).toBeVisible();
  };

  await page.goto("/");
  await openCardFromList(page, "Анна");
  await page.getByRole("link", { name: "Изменить" }).click();
  await nameField().fill("Анна Петрова");
  await groupBox().click();
  await save();

  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(nameField()).toHaveValue("Анна Петрова");
  await expect(groupBox()).toBeChecked();

  await save();

  await expect(page.getByRole("heading", { level: 1, name: "Анна Петрова" })).toBeVisible();
  await expect(detailLine(page, "Группы")).toHaveText("Теннис");
});

test("a note to an overdue contact takes them out of the block", async ({ page }) => {
  await seedContacts([
    {
      name: "Ольга",
      frequency: "month",
      createdAt: new Date(2026, 0, 15, 12),
      noteAt: new Date(2026, 8, 3, 12),
    },
    overdue("Анна", 20),
    overdue("Иван", 3),
    { name: "Глеб", frequency: "month", createdAt: daysAgo(2) },
  ]);

  await test.step("the home page shows the overdue contacts, the most overdue first", async () => {
    await page.goto("/");

    await expect(block(page).getByText("3 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Ольга/, /Анна/, /Иван/]);
    await expect(blockRow(page, "Ольга")).toContainText(
      "раз в месяц · последняя заметка 3 сентября 2026 г.",
    );
    await expect(blockRow(page, "Иван")).toContainText("раз в неделю · заметок пока нет");
  });

  await test.step("a row of the block opens the card of the contact", async () => {
    await blockRow(page, "Ольга").getByRole("link").click();

    await expect(page.getByRole("heading", { level: 1, name: "Ольга" })).toBeVisible();
    await expect(frequencyLine(page)).toHaveText("Раз в месяц · пора связаться");
  });

  await test.step("a new note restarts the due date", async () => {
    await page.getByLabel("Новая заметка").fill("Созвонились");
    await page.getByRole("button", { name: "Добавить заметку" }).click();

    await expect(visibleText(page, "Заметка сохранена")).toBeVisible();
    await expect(frequencyLine(page)).toHaveText(/^Раз в месяц · связаться до .+ г\.$/);
  });

  await test.step("back on the home page the contact has left the block", async () => {
    await page.getByRole("link", { name: "Все контакты" }).click();

    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Иван/]);
  });
});

test("a deleted contact leaves the block", async ({ page }) => {
  await seedContacts([overdue("Анна", 20), overdue("Иван", 3)]);

  await page.goto("/");
  await blockRow(page, "Анна").getByRole("link").click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();

  await expect(visibleText(page, "Контакт «Анна» удалён")).toBeVisible();
  await expect(block(page).getByText("1 контакт")).toBeVisible();
  await expect(blockRows(page)).toHaveText([/Иван/]);
});

test("search leaves the block alone, and a group narrows it", async ({ page }) => {
  await seedContacts(
    [
      overdue("Анна", 40, "Теннис"),
      overdue("Борис", 30, "Теннис"),
      overdue("Вера", 20),
      { name: "Глеб", frequency: "week", createdAt: daysAgo(2), group: "Теннис" },
      { name: "Дарья", group: "Семья" },
    ],
    ["Семья"],
  );
  await page.goto("/");
  await expect(blockRows(page)).toHaveText([/Анна/, /Борис/, /Вера/]);

  await test.step("search filters only the common list", async () => {
    await searchBox(page).fill("Глеб");

    await expect(visibleText(page, "Найдено: 1 контакт из 5")).toBeVisible();
    await expect(listRows(page)).toHaveText([/Глеб/]);
    await expect(block(page).getByText("3 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Борис/, /Вера/]);
  });

  await test.step("a group leaves only its people in the block", async () => {
    await searchBox(page).fill("");
    await expect(visibleText(page, "Всего 5 контактов")).toBeVisible();

    await selectGroup(page, "Теннис");

    await expect(visibleText(page, "В группе «Теннис»: 3 контакта")).toBeVisible();
    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Борис/]);
  });

  await test.step("search inside a group keeps the block of that group", async () => {
    await searchBox(page).fill("Глеб");

    await expect(visibleText(page, "Найдено: 1 контакт из 3")).toBeVisible();
    await expect(listRows(page)).toHaveText([/Глеб/]);
    await expect(block(page).getByText("2 контакта")).toBeVisible();
    await expect(blockRows(page)).toHaveText([/Анна/, /Борис/]);
  });

  await test.step("a group with nobody overdue has no block", async () => {
    await searchBox(page).fill("");
    await expect(visibleText(page, "В группе «Теннис»: 3 контакта")).toBeVisible();

    await selectGroup(page, "Семья");

    await expect(visibleText(page, "В группе «Семья»: 1 контакт")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });
});

test("the block shows five contacts and expands to all of them", async ({ page }) => {
  await seedContacts(manyOverdue(12, (index) => (index < 7 ? "Теннис" : undefined)));
  const rowsOf = (count: number) => firstNames(count).map((name) => new RegExp(name));

  await test.step("only the first five are shown", async () => {
    await page.goto("/");

    await expect(block(page).getByText("12 контактов")).toBeVisible();
    await expect(blockRows(page)).toHaveText(rowsOf(5));
    await expect(showAll(page, 12)).toBeVisible();
    await expect(collapse(page)).toHaveCount(0);
  });

  await test.step("the button shows everyone, the most overdue first", async () => {
    await showAll(page, 12).click();

    await expect(blockRows(page)).toHaveText(rowsOf(12));
    await expect(collapse(page)).toBeVisible();
    await expect(showAll(page, 12)).toHaveCount(0);
  });

  await test.step("collapsing leaves the first five again", async () => {
    await collapse(page).click();

    await expect(blockRows(page)).toHaveText(rowsOf(5));
    await expect(showAll(page, 12)).toBeVisible();
  });

  await test.step("another group starts collapsed", async () => {
    await showAll(page, 12).click();
    await expect(blockRows(page)).toHaveCount(12);

    await selectGroup(page, "Теннис");

    await expect(block(page).getByText("7 контактов")).toBeVisible();
    await expect(blockRows(page)).toHaveText(rowsOf(5));
    await expect(showAll(page, 7)).toBeVisible();
  });
});

test("collapsing a long list brings the block back on screen", async ({ page }) => {
  await seedContacts(manyOverdue(30));
  await page.goto("/");
  await showAll(page, 30).click();
  await expect(blockRows(page)).toHaveCount(30);

  await collapse(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(block(page).getByRole("heading", { name: "Пора связаться" })).not.toBeInViewport();

  await collapse(page).click();

  await expect(blockRows(page)).toHaveCount(5);
  await expect(block(page).getByRole("heading", { name: "Пора связаться" })).toBeInViewport();
});

test("collapsing a block that fits on screen does not scroll the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedContacts(manyOverdue(7));
  await page.goto("/");
  await showAll(page, 7).click();
  await expect(blockRows(page)).toHaveCount(7);

  await page.evaluate(() => window.scrollTo(0, 60));
  await expect(block(page).getByRole("heading", { name: "Пора связаться" })).toBeInViewport({
    ratio: 1,
  });
  await expect(collapse(page)).toBeInViewport({ ratio: 1 });
  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBeGreaterThan(0);

  await collapse(page).click();

  await expect(blockRows(page)).toHaveCount(5);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});

test("a short block has no buttons, and with nobody overdue there is no block", async ({
  page,
}) => {
  await test.step("four overdue contacts are all shown without buttons", async () => {
    await seedContacts(manyOverdue(4));
    await page.goto("/");

    await expect(blockRows(page)).toHaveText(firstNames(4).map((name) => new RegExp(name)));
    await expect(block(page).getByRole("button")).toHaveCount(0);
  });

  await test.step("no block when nobody is overdue or has a frequency", async () => {
    await seedContacts([
      { name: "Анна", frequency: "month", createdAt: daysAgo(2) },
      { name: "Борис" },
    ]);
    await page.goto("/");

    await expect(visibleText(page, "Всего 2 контакта")).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });
});
