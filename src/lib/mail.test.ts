import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const link = "http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2F";

describe("loginEmail", () => {
  it("has the subject and a button that leads to the link", async () => {
    const { loginEmail } = await import("./login-email");

    const letter = loginEmail(link);

    expect(letter.subject).toBe("Вход в Личную CRM");
    // "&" in the link is escaped in HTML, the button still leads to the same address.
    expect(letter.html).toContain(
      `<a href="http://localhost:3000/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"`,
    );
    expect(letter.html).toMatch(/>\s*Войти\s*<\/a>/);
  });

  it("says that the link works 15 minutes and that the letter can be ignored", async () => {
    const { loginEmail } = await import("./login-email");

    const { html, text } = loginEmail(link);

    for (const body of [html, text]) {
      expect(body).toContain("15 минут");
      expect(body).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    }
  });

  it("has the link in the plain text version as it is", async () => {
    const { loginEmail } = await import("./login-email");

    expect(loginEmail(link).text).toContain(link);
  });

  it("does not let a character of the link break out of the HTML attribute", async () => {
    const { loginEmail } = await import("./login-email");

    const { html } = loginEmail('http://x/?a="><script>alert(1)</script>');

    expect(html).not.toContain("<script>");
  });
});

describe("sendLoginEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
    vi.resetModules();
  });

  it("sends from «Личная CRM» noreply@mail.crm.chigabugadaga.ru to the address", async () => {
    vi.stubEnv("SMTP_URL", "smtp://127.0.0.1:1025");
    const { sendLoginEmail } = await import("./mail");

    await sendLoginEmail("anna@example.com", link);

    expect(createTransport).toHaveBeenCalledWith("smtp://127.0.0.1:1025");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: "Личная CRM", address: "noreply@mail.crm.chigabugadaga.ru" },
        to: "anna@example.com",
        subject: "Вход в Личную CRM",
        html: expect.stringContaining("Войти"),
        text: expect.stringContaining(link),
      }),
    );
  });

  it("creates the transport once for many letters", async () => {
    vi.stubEnv("SMTP_URL", "smtp://127.0.0.1:1025");
    const { sendLoginEmail } = await import("./mail");

    await sendLoginEmail("anna@example.com", link);
    await sendLoginEmail("boris@example.com", link);

    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  it("fails with a clear error when SMTP_URL is not set", async () => {
    vi.stubEnv("SMTP_URL", "");
    const { sendLoginEmail } = await import("./mail");

    await expect(sendLoginEmail("anna@example.com", link)).rejects.toThrow(/SMTP_URL/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("passes the failure of the mail server on", async () => {
    vi.stubEnv("SMTP_URL", "smtp://127.0.0.1:1025");
    sendMail.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { sendLoginEmail } = await import("./mail");

    await expect(sendLoginEmail("anna@example.com", link)).rejects.toThrow("ECONNREFUSED");
  });
});
