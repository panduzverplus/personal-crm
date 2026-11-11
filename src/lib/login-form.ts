// What the login form shows after "Получить ссылку". `email` is what was typed, so the field
// keeps it; `sentTo` is the address the letter went to (trimmed, lowercase).
export type LoginFormState =
  | { status: "idle"; email: string }
  | { status: "sent"; email: string; sentTo: string }
  | { status: "invalid"; email: string }
  | { status: "limited"; email: string }
  | { status: "failed"; email: string };

export const initialLoginFormState: LoginFormState = { status: "idle", email: "" };

// Messages are shown in the UI, so they are in Russian.
export const LOGIN_MESSAGES = {
  sent: (email: string) => `Ссылка для входа отправлена на ${email}`,
  invalid: "Проверь адрес почты",
  limited: "Слишком часто, попробуй через несколько минут",
  failed: "Не удалось отправить письмо. Попробуй ещё раз.",
} as const;
