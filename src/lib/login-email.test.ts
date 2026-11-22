import { describe, expect, it } from "vitest";
import { contactSchema } from "./contact-form";
import { parseLoginEmail } from "./login-email";

describe("parseLoginEmail", () => {
  it("accepts a normal address", () => {
    expect(parseLoginEmail("anna@example.com")).toEqual({ ok: true, email: "anna@example.com" });
  });

  it("drops spaces at the edges", () => {
    expect(parseLoginEmail("  anna@example.com \n")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("lowercases the address, so letter case does not make another user", () => {
    expect(parseLoginEmail("  Anna@Example.COM ")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it.each(["anna@", "@example.com", "anna", "anna@example", "an na@example.com", ""])(
    "rejects %j",
    (raw) => {
      expect(parseLoginEmail(raw)).toEqual({ ok: false });
    },
  );

  it("rejects a string of spaces", () => {
    expect(parseLoginEmail("   ")).toEqual({ ok: false });
  });

  it("rejects something that is not a string", () => {
    expect(parseLoginEmail(undefined)).toEqual({ ok: false });
    expect(parseLoginEmail(42)).toEqual({ ok: false });
    expect(parseLoginEmail(null)).toEqual({ ok: false });
  });

  it("rejects an absurdly long address", () => {
    expect(parseLoginEmail(`${"a".repeat(300)}@example.com`)).toEqual({ ok: false });
  });

  // The rule of "a correct address" is one for the whole app: the login form and the contact's "Почта" field.
  it.each([
    "anna@example.com",
    "anna.petrova+crm@sub.example.co",
    "anna@",
    "anna@example",
    "no-at-sign.example.com",
    "a b@example.com",
    "анна@пример.рф",
  ])("agrees with the contact email field about %j", (value) => {
    const contact = contactSchema.safeParse({
      name: "Анна",
      about: "",
      howWeMet: "",
      phone: "",
      email: value,
      contactFrequency: "",
      birthday: "",
    });

    expect(parseLoginEmail(value).ok).toBe(contact.success);
  });
});
