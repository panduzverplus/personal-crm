import { isValidEmail } from "@/lib/email";

/** Sender of every login letter. The domain is the one verified in Resend. */
export const LOGIN_EMAIL_SENDER = {
  name: "Личная CRM",
  address: "noreply@mail.crm.chigabugadaga.ru",
} as const;

/** How long a login link works, in minutes. Keep in step with `expiresIn` in src/lib/auth.ts. */
export const LOGIN_LINK_MINUTES = 15;

const SUBJECT = "Вход в Личную CRM";
const IGNORE_LINE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The login letter: HTML with the "Войти" button and a plain text version with the same link.
 * Mail clients know no CSS variables, so the colors repeat the palette tokens of globals.css
 * (peach, ink) as plain values, in inline styles.
 */
export function loginEmail(url: string) {
  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#e3c1aa;font-family:Arial,Helvetica,sans-serif;color:#262626;">
    <div style="max-width:480px;margin:0 auto;">
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">Вход в Личную CRM</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 24px;">Нажмите кнопку, чтобы войти. Ссылка работает один раз и ${LOGIN_LINK_MINUTES} минут.</p>
      <p style="margin:0 0 24px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;background:#262626;color:#e3c1aa;border-radius:14px;font-size:16px;text-decoration:none;">Войти</a>
      </p>
      <p style="font-size:14px;line-height:1.5;margin:0;color:#5c4a3e;">${IGNORE_LINE}</p>
    </div>
  </body>
</html>`;
  const text = [
    "Вход в Личную CRM",
    "",
    `Откройте ссылку, чтобы войти. Она работает один раз и ${LOGIN_LINK_MINUTES} минут:`,
    url,
    "",
    IGNORE_LINE,
  ].join("\n");

  return { subject: SUBJECT, html, text };
}

// An address cannot be longer (RFC 5321); this only stops absurd input before it reaches the database.
const MAX_EMAIL_LENGTH = 254;

export type LoginEmail = { ok: true; email: string } | { ok: false };

/**
 * The email for login: spaces at the edges are dropped and the letters are lowercased, so
 * "  Anna@Example.com " and "anna@example.com" are one user. Runs on the server for every request
 * for a login link, not only for the ones from the form.
 */
export function parseLoginEmail(raw: unknown): LoginEmail {
  if (typeof raw !== "string") {
    return { ok: false };
  }
  const email = raw.trim().toLowerCase();
  if (email === "" || email.length > MAX_EMAIL_LENGTH || !isValidEmail(email)) {
    return { ok: false };
  }
  return { ok: true, email };
}
