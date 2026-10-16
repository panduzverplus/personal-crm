// Source lists and generators for realistic-looking test contacts (Russian locale).

type Gender = "m" | "f";
type Gendered = { m: string; f: string };

export type Random = () => number;

/** Deterministic PRNG (mulberry32) so every seed run produces the same data. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: Random, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const chance = (random: Random, probability: number) => random() < probability;

const randomInt = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

const MALE_FIRST_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим",
  "Валентин", "Василий", "Виктор", "Виталий", "Владимир", "Владислав",
  "Вячеслав", "Геннадий", "Георгий", "Глеб", "Григорий", "Даниил", "Денис",
  "Дмитрий", "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл",
  "Константин", "Лев", "Леонид", "Максим", "Марк", "Матвей", "Михаил",
  "Никита", "Николай", "Олег", "Павел", "Пётр", "Роман", "Руслан", "Семён",
  "Сергей", "Станислав", "Степан", "Тимофей", "Тимур", "Фёдор", "Юрий",
  "Ярослав",
] as const;

const FEMALE_FIRST_NAMES = [
  "Алёна", "Алина", "Алиса", "Анастасия", "Анна", "Валентина", "Валерия",
  "Варвара", "Василиса", "Вера", "Вероника", "Виктория", "Галина", "Дарья",
  "Диана", "Ева", "Евгения", "Екатерина", "Елена", "Елизавета", "Жанна",
  "Зоя", "Инна", "Ирина", "Карина", "Кира", "Кристина", "Ксения", "Лариса",
  "Лидия", "Любовь", "Людмила", "Маргарита", "Марина", "Мария", "Милана",
  "Надежда", "Наталья", "Нина", "Оксана", "Ольга", "Полина", "Светлана",
  "София", "Таисия", "Тамара", "Татьяна", "Ульяна", "Юлия", "Яна",
] as const;

// Male forms; female forms are derived in `surnameFor`.
const SURNAMES = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов",
  "Михайлов", "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев",
  "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов",
  "Николаев", "Орлов", "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев",
  "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв",
  "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв",
  "Гусев", "Киселёв", "Ильин", "Максимов", "Поляков", "Сорокин",
  "Виноградов", "Ковалёв", "Белов", "Медведев", "Антонов", "Тарасов",
  "Жуков", "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев",
  "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов",
  "Марков", "Миронов", "Крылов", "Куликов", "Карпов", "Власов", "Мельников",
  "Денисов", "Гаврилов", "Тихонов", "Казаков", "Афанасьев", "Данилов",
  "Савельев", "Тимофеев", "Фомин", "Чернов", "Абрамов", "Мартынов",
  "Ефимов", "Федотов", "Щербаков", "Назаров", "Калинин", "Исаев",
  "Чернышёв", "Быков", "Маслов", "Родионов", "Коновалов", "Лазарев",
  "Воронин", "Климов", "Филатов", "Пономарёв", "Голубев", "Кудрявцев",
  "Прохоров", "Наумов", "Потапов", "Журавлёв", "Овчинников", "Трофимов",
  "Леонов", "Соболев", "Ермаков", "Колесников", "Гончаров", "Емельянов",
  "Никифоров", "Грачёв", "Котов", "Гришин", "Ефремов", "Архипов", "Громов",
  "Кириллов", "Малышев", "Панов", "Моисеев", "Румянцев", "Акимов",
  "Кондратьев", "Бирюков", "Горбунов", "Анисимов", "Тихомиров", "Галкин",
  "Лукьянов", "Скворцов", "Белоусов", "Нестеров", "Симонов", "Князев",
  "Цветков", "Левин", "Воронов", "Аксёнов", "Мальцев", "Логинов", "Горшков",
  "Краснов", "Демидов", "Елисеев", "Рыбаков", "Плотников", "Хохлов",
  "Фадеев", "Молчанов", "Литвинов", "Ершов", "Ушаков", "Рябов", "Мухин",
  "Бородин", "Платонов", "Некрасов", "Бобров", "Жданов", "Блинов",
  "Муравьёв", "Дроздов", "Лавров", "Зуев", "Ларин", "Серов", "Зотов",
  "Устинов", "Фокин", "Самойлов", "Сахаров", "Шишкин", "Чистяков", "Носов",
  "Воронцов", "Зверев", "Селезнёв", "Нечаев", "Седов", "Головин", "Терехов",
  "Шестаков", "Гордеев", "Пахомов", "Зимин", "Широков", "Суворов", "Львов",
  "Лукин", "Токарев", "Шилов", "Родин", "Покровский", "Никольский",
  "Березин", "Круглов", "Третьяков", "Шмелёв", "Лаптев", "Зорин", "Уткин",
  "Высоцкий", "Вишневский", "Островский", "Козловский", "Жуковский",
  "Черных", "Шевченко", "Бондаренко", "Коваленко", "Ткаченко", "Ким", "Цой",
] as const;

function surnameFor(surname: string, gender: Gender): string {
  if (gender === "m") return surname;
  if (/(ский|цкий)$/.test(surname)) return surname.slice(0, -2) + "ая";
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return surname + "а";
  return surname;
}

const OCCUPATIONS = [
  "Дизайнер интерфейсов", "Frontend-разработчик", "Бэкенд-разработчик",
  "Продакт-менеджер", "Бухгалтер", "Юрист", "Врач-терапевт", "Стоматолог",
  "Риелтор", "Фотограф", "Учитель математики", "Преподаватель английского",
  "Архитектор", "Инженер-строитель", "Маркетолог", "SMM-специалист",
  "Финансовый аналитик", "Аналитик данных", "HR-менеджер", "Рекрутер",
  "Тренер по теннису", "Фитнес-тренер", "Психолог", "Журналист", "Редактор",
  "Переводчик", "Владелец кофейни", "Предприниматель", "Основатель стартапа",
  "Шеф-повар", "Автомеханик", "Мастер по ремонту квартир", "Электрик",
  "Ветеринар", "Нотариус", "Менеджер в банке", "Страховой агент",
  "Музыкант", "Звукорежиссёр", "Видеомонтажёр", "Иллюстратор",
  "Event-менеджер", "Тимлид разработки", "Технический директор", "Инвестор",
  "Студент", "Аспирант", "Научный сотрудник", "Пилот", "Логист",
  "Менеджер по продажам", "Директор по маркетингу", "Флорист", "Парикмахер",
  "Косметолог", "Массажист", "Туроператор", "Экскурсовод", "Сомелье",
  "Тестировщик", "DevOps-инженер", "Системный администратор", "Копирайтер",
  "Педиатр", "Хирург", "Фармацевт", "Йога-инструктор", "Агроном",
  "Мебельщик", "Ювелир", "Кондитер", "Агент по недвижимости",
] as const;

const RELATIONS: readonly Gendered[] = [
  { m: "одноклассник", f: "одноклассница" },
  { m: "однокурсник", f: "однокурсница" },
  { m: "бывший коллега", f: "бывшая коллега" },
  { m: "сосед по дому", f: "соседка по дому" },
  { m: "друг детства", f: "подруга детства" },
  { m: "двоюродный брат", f: "двоюродная сестра" },
  { m: "друг семьи", f: "подруга семьи" },
  { m: "знакомый по спортзалу", f: "знакомая по спортзалу" },
  { m: "бывший клиент", f: "бывшая клиентка" },
  { m: "партнёр по проекту", f: "партнёр по проекту" },
  { m: "наставник", f: "наставница" },
  { m: "сосед по даче", f: "соседка по даче" },
];

const FRIENDS = [
  { gen: "Саши", acc: "Сашу" }, { gen: "Лены", acc: "Лену" },
  { gen: "Димы", acc: "Диму" }, { gen: "Кати", acc: "Катю" },
  { gen: "Миши", acc: "Мишу" }, { gen: "Оли", acc: "Олю" },
  { gen: "Серёжи", acc: "Серёжу" }, { gen: "Ани", acc: "Аню" },
  { gen: "Андрея", acc: "Андрея" }, { gen: "Маши", acc: "Машу" },
  { gen: "Паши", acc: "Пашу" }, { gen: "Насти", acc: "Настю" },
  { gen: "Игоря", acc: "Игоря" }, { gen: "Юли", acc: "Юлю" },
  { gen: "Кости", acc: "Костю" }, { gen: "Тани", acc: "Таню" },
] as const;

const UNIVERSITIES = [
  "МГУ", "СПбГУ", "МФТИ", "Вышке", "Бауманке", "МИФИ", "УрФУ", "НГУ",
  "КФУ", "ИТМО",
] as const;

const CONFERENCES = [
  "HighLoad++", "ProductCamp", "РИФ", "TechTrain", "DUMP", "Mobius",
  "«Белые ночи»", "«Стачка»", "CodeFest", "Design Prosmotr",
] as const;

const COMPANIES = [
  "«Альфа-Софт»", "студии «Пиксель»", "агентстве «Север»",
  "стартапе про доставку", "банке «Восток»", "типографии «Оттиск»",
  "интернет-магазине «Корзинка»", "строительной компании «Опора»",
  "школе №57", "редакции «Городского вестника»",
] as const;

const PLACES = [
  "Сочи", "Казани", "Калининграде", "Карелии", "Стамбуле", "Ереване",
  "Тбилиси", "Мурманске", "Нижнем Новгороде", "Иркутске", "Ярославле",
  "Питере",
] as const;

const TOPICS = [
  "фронтенду", "инвестициям", "фотографии", "продуктовому менеджменту",
  "керамике", "бегу", "дизайну", "настольным играм", "кулинарии",
  "психологии", "истории искусства",
] as const;

const MONTHS_IN = [
  "в январе", "в феврале", "в марте", "в апреле", "в мае", "в июне",
  "в июле", "в августе", "в сентябре", "в октябре", "в ноябре", "в декабре",
] as const;

const DISCUSSION_TOPICS = [
  "ремонт квартиры", "переезд", "смену работы", "инвестиции",
  "поездку в горы", "запуск своего проекта", "учёбу детей", "покупку машины",
  "отпуск на море", "новую должность", "свадьбу", "курсы по программированию",
] as const;

const BOOKS = [
  "Мастер и Маргарита", "Сто лет одиночества", "Думай медленно… решай быстро",
  "Атлант расправил плечи", "Цветы для Элджернона", "Задача трёх тел",
  "Пикник на обочине", "Шантарам", "Чистый код", "Финансист",
] as const;

const INTERESTS = [
  "хороший кофе", "джаз", "горные лыжи", "рыбалку", "настольные игры",
  "футбол", "вино", "театр", "велосипед", "фотографию", "сапсёрфинг",
  "грузинскую кухню", "книги по истории", "походы",
] as const;

const SPECIALISTS = [
  "стоматолога", "юриста", "бухгалтера", "автомеханика", "репетитора",
  "мастера по ремонту", "риелтора", "психолога", "фотографа",
] as const;

const CITIES = [
  "Москву", "Петербург", "Казань", "Екатеринбург", "Новосибирск",
  "Калининград", "Сочи", "Краснодар", "Тбилиси", "Ереван",
] as const;

function howWeMet(random: Random): string | null {
  const friend = pick(random, FRIENDS);
  const templates: Array<() => string> = [
    () => `Учились вместе в ${pick(random, UNIVERSITIES)}`,
    () => "Учились в одной школе",
    () => `Познакомились на конференции ${pick(random, CONFERENCES)} в ${randomInt(random, 2016, 2025)} году`,
    () => `Работали вместе в ${pick(random, COMPANIES)}`,
    () => "Соседи по даче",
    () => "Живём в одном доме",
    () => `Познакомились на дне рождения у ${friend.gen}`,
    () => `Познакомились через ${friend.acc}`,
    () => "Ходим в один спортзал",
    () => "Играем вместе в футбол по субботам",
    () => `Познакомились в отпуске в ${pick(random, PLACES)}`,
    () => "Вместе ходили на курсы английского",
    () => "Через общих друзей",
    () => "Родители дружат с детства",
    () => "Вместе волонтёрили в фонде помощи животным",
    () => "Сидели рядом в самолёте, разговорились",
    () => `Были на свадьбе у ${friend.gen}`,
    () => "Работаем в одном коворкинге",
    () => `Познакомились на митапе по ${pick(random, TOPICS)}`,
    () => `Ходили вместе на мастер-класс по ${pick(random, TOPICS)}`,
    () => "Книжный клуб по четвергам",
    () => "Родительский чат в детском саду",
  ];
  return chance(random, 0.9) ? pick(random, templates)() : null;
}

function about(random: Random, gender: Gender): string | null {
  const roll = random();
  if (roll < 0.5) return pick(random, OCCUPATIONS);
  if (roll < 0.8) {
    return `${pick(random, OCCUPATIONS)}, ${pick(random, RELATIONS)[gender]}`;
  }
  if (roll < 0.95) {
    const relation = pick(random, RELATIONS)[gender];
    return relation[0].toUpperCase() + relation.slice(1);
  }
  return null;
}

function noteBody(random: Random, gender: Gender): string {
  const month = pick(random, MONTHS_IN);
  const verb = (forms: Gendered) => forms[gender];
  const templates: Array<() => string> = [
    () => "Созвонились, договорились встретиться на следующей неделе.",
    () => `Обсудили ${pick(random, DISCUSSION_TOPICS)}. Договорились вернуться к разговору ${month}.`,
    () => `Обещает прислать контакт хорошего ${pick(random, SPECIALISTS)}.`,
    () => `Был день рождения. Любит ${pick(random, INTERESTS)} — пригодится для подарка.`,
    () => `Советует книгу «${pick(random, BOOKS)}» — надо прочитать.`,
    () => `Переезжает в ${pick(random, CITIES)}, спросить новый адрес.`,
    () => `Договорились вместе сходить на концерт ${month}.`,
    () => `Хорошо разбирается в теме «${pick(random, DISCUSSION_TOPICS)}» — можно спросить совета.`,
    () => `Зовёт на новоселье ${month}.`,
    () => `Встретились за кофе. ${verb({ m: "Рассказал", f: "Рассказала" })} про новую работу, всё нравится.`,
    () => "Вернуть книгу при следующей встрече.",
    () => `Договорились: я помогаю с резюме, в ответ — знакомство с командой.\nНапомнить ${month}.`,
    () => `${verb({ m: "Попросил", f: "Попросила" })} порекомендовать хорошего врача — контакты отправлены.`,
    () => `Ребёнок пошёл в первый класс. Спросить, как дела, ${month}.`,
    () => "Обменялись рекомендациями по сериалам. Ждёт мнения про последний сезон.",
    () => `Планирует отпуск в ${pick(random, PLACES)}. Поделиться списком мест.`,
    () => `${verb({ m: "Звонил", f: "Звонила" })} уточнить детали по совместному проекту. Всё в силе.`,
    () => "Скинуть фотографии с последней встречи.",
  ];
  return pick(random, templates)();
}

const RU_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const transliterate = (value: string) =>
  [...value.toLowerCase()].map((char) => RU_TO_LATIN[char] ?? char).join("");

const EMAIL_DOMAINS = [
  "gmail.com", "yandex.ru", "mail.ru", "outlook.com", "icloud.com",
  "proton.me",
] as const;

function email(random: Random, firstName: string, lastName: string): string {
  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const local = pick(random, [
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}`,
    `${first}_${last}`,
  ]);
  const suffix = chance(random, 0.35) ? String(randomInt(random, 1, 99)) : "";
  return `${local}${suffix}@${pick(random, EMAIL_DOMAINS)}`;
}

function phone(random: Random): string {
  const digits = (count: number) =>
    Array.from({ length: count }, () => randomInt(random, 0, 9)).join("");
  return `+7 9${digits(2)} ${digits(3)}-${digits(2)}-${digits(2)}`;
}

export type GeneratedContact = {
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  notes: { body: string; createdAt: Date }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Moves a timestamp to a plausible waking hour on the same day, kept within [earliest, latest]. */
function atDaytime(
  random: Random,
  date: Date,
  earliest: Date,
  latest: Date,
): Date {
  const result = new Date(date);
  result.setHours(randomInt(random, 9, 21), randomInt(random, 0, 59), 0, 0);
  if (result < earliest) return new Date(earliest);
  if (result > latest) return new Date(latest);
  return result;
}

export function generateContacts(
  total: number,
  random: Random,
  now: Date,
): GeneratedContact[] {
  const usedNames = new Set<string>();
  const result: GeneratedContact[] = [];

  while (result.length < total) {
    const gender: Gender = chance(random, 0.5) ? "m" : "f";
    const firstName = pick(
      random,
      gender === "m" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES,
    );
    const lastName = surnameFor(pick(random, SURNAMES), gender);
    const name = `${firstName} ${lastName}`;
    // Unique names keep "find by name" checks unambiguous.
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const createdDay = new Date(
      now.getTime() - randomInt(random, 30, 3 * 365) * DAY_MS,
    );
    const createdAt = atDaytime(random, createdDay, createdDay, now);

    const noteCount = pick(random, [0, 0, 1, 1, 1, 2, 2, 2, 3, 4]);
    const noteDates = Array.from({ length: noteCount }, () =>
      atDaytime(
        random,
        new Date(
          createdAt.getTime() +
            random() * (now.getTime() - createdAt.getTime()),
        ),
        createdAt,
        now,
      ),
    ).sort((a, b) => a.getTime() - b.getTime());

    result.push({
      name,
      about: about(random, gender),
      howWeMet: howWeMet(random),
      phone: chance(random, 0.9) ? phone(random) : null,
      email: chance(random, 0.75) ? email(random, firstName, lastName) : null,
      createdAt,
      notes: noteDates.map((date) => ({
        body: noteBody(random, gender),
        createdAt: date,
      })),
    });
  }

  return result;
}
