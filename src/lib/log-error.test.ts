import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "./log-error";

const NAME = "Ivan Petrov";
const PHONE = "+7 999 123-45-67";
const EMAIL = "ivan@example.com";
const NOTE = "met at the conference, owes me a book";

// Shaped like what Drizzle throws: the message and `params` carry the typed values,
// the Postgres error sits on `cause` and quotes the row in `detail`.
class DrizzleQueryError extends Error {
  query: string;
  params: unknown[];
  cause: unknown;

  constructor(query: string, params: unknown[], cause: unknown) {
    super(`Failed query: ${query}\nparams: ${params}`);
    this.query = query;
    this.params = params;
    this.cause = cause;
  }
}

class PostgresError extends Error {
  code = "23502";
  table_name = "contacts";
  column_name = "name";
  constraint_name = "contacts_name_not_null";
  detail = `Failing row contains (1, ${NAME}, ${PHONE}, ${EMAIL}, ${NOTE}).`;
}

function loggedText(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.flat().map(String).join("\n");
}

describe("logError", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("logs the label, the error type and the Postgres details", () => {
    const cause = new PostgresError(`null value in column "name" (${NAME})`);
    const error = new DrizzleQueryError(
      "insert into contacts (name, phone, email, notes) values ($1, $2, $3, $4)",
      [NAME, PHONE, EMAIL, NOTE],
      cause,
    );

    logError("Failed to create contact", error);

    const text = loggedText(spy);
    expect(text).toContain("Failed to create contact");
    expect(text).toContain("DrizzleQueryError");
    expect(text).toContain("23502");
    expect(text).toContain("contacts");
    expect(text).toContain("name");
    expect(text).toContain("contacts_name_not_null");
  });

  it("does not log any value typed by the user", () => {
    const cause = new PostgresError(`null value in column "name" (${NAME})`);
    const error = new DrizzleQueryError(
      "insert into contacts (name, phone, email, notes) values ($1, $2, $3, $4)",
      [NAME, PHONE, EMAIL, NOTE],
      cause,
    );

    logError("Failed to create contact", error);

    const text = loggedText(spy);
    for (const secret of [NAME, PHONE, EMAIL, NOTE, "Ivan", "params"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("logs only the type of a plain error, not its text", () => {
    logError("Failed to add note", new Error(`secret ${NOTE}`));

    const text = loggedText(spy);
    expect(text).toContain("Failed to add note");
    expect(text).toContain("Error");
    expect(text).not.toContain(NOTE);
  });

  it("does not log a value that is not an error", () => {
    logError("Failed to add note", NOTE);
    logError("Failed to add note", null);
    logError("Failed to add note", { message: NOTE, params: [NAME] });

    const text = loggedText(spy);
    expect(text).toContain("Failed to add note");
    expect(text).not.toContain(NOTE);
    expect(text).not.toContain(NAME);
  });
});
