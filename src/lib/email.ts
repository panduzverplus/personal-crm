import { z } from "zod";

/** The one rule of "a correct email address" for the whole app: the contact form and the login. */
export function isValidEmail(value: string) {
  return z.email().safeParse(value).success;
}
