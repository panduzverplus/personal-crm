import "server-only";
import nodemailer from "nodemailer";
import { LOGIN_EMAIL_SENDER, loginEmail } from "@/lib/login-email";

// Where the letters go is decided by the SMTP_URL setting, not by the code:
// on a computer and in the tests it is the Mailpit stub (smtp://127.0.0.1:1025),
// on the server it is the SMTP gateway of Resend.

type Transport = ReturnType<typeof nodemailer.createTransport>;

let transport: Transport | undefined;

function getTransport() {
  if (!transport) {
    const url = process.env.SMTP_URL;
    if (!url) {
      throw new Error("SMTP_URL is not set: the app does not know where to send login letters");
    }
    transport = nodemailer.createTransport(url);
  }
  return transport;
}

/** Sends the letter with the login link. Rejects when the mail server cannot take the letter. */
export async function sendLoginEmail(to: string, url: string) {
  const { subject, html, text } = loginEmail(url);
  await getTransport().sendMail({ from: LOGIN_EMAIL_SENDER, to, subject, html, text });
}
