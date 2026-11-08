import { describe, expect, it } from "vitest";
import { dueDate, isOverdue, keepInTouchStatus, overdueRowDetails } from "./keep-in-touch";

describe("dueDate", () => {
  it("adds 7 days for a weekly frequency", () => {
    expect(dueDate(new Date(2026, 9, 5), "week")).toEqual(new Date(2026, 9, 12));
  });

  it("adds a calendar month for a monthly frequency", () => {
    expect(dueDate(new Date(2026, 2, 1), "month")).toEqual(new Date(2026, 3, 1));
  });

  it("adds three calendar months for a quarterly frequency", () => {
    expect(dueDate(new Date(2026, 0, 15), "quarter")).toEqual(new Date(2026, 3, 15));
  });

  it("falls on the last day of February when the month has no such day", () => {
    expect(dueDate(new Date(2026, 0, 31), "month")).toEqual(new Date(2026, 1, 28));
  });

  it("falls on February 29 in a leap year", () => {
    expect(dueDate(new Date(2028, 0, 31), "month")).toEqual(new Date(2028, 1, 29));
  });

  it("ignores the time of day of the reference date", () => {
    expect(dueDate(new Date(2026, 9, 5, 23, 30), "week")).toEqual(new Date(2026, 9, 12));
  });
});

describe("isOverdue", () => {
  const due = new Date(2026, 9, 12);

  it("is not overdue on the due day, even late in the evening", () => {
    expect(isOverdue(due, new Date(2026, 9, 12, 23, 59))).toBe(false);
  });

  it("is overdue from the start of the next day", () => {
    expect(isOverdue(due, new Date(2026, 9, 13, 0, 0))).toBe(true);
  });
});

describe("keepInTouchStatus", () => {
  it("shows the frequency and the due date while the due date is ahead", () => {
    expect(keepInTouchStatus("month", new Date(2026, 9, 3), new Date(2026, 9, 25))).toBe(
      "Раз в месяц · связаться до 3 ноября 2026 г.",
    );
  });

  it("shows the frequency and a call to get in touch once the due date has passed", () => {
    expect(keepInTouchStatus("month", new Date(2026, 8, 3), new Date(2026, 9, 25))).toBe(
      "Раз в месяц · пора связаться",
    );
  });
});

describe("overdueRowDetails", () => {
  it("shows the frequency and the date of the last note", () => {
    expect(overdueRowDetails("month", new Date(2026, 8, 3))).toBe(
      "раз в месяц · последняя заметка 3 сентября 2026 г.",
    );
  });

  it("says there are no notes yet when the contact has none", () => {
    expect(overdueRowDetails("week", null)).toBe("раз в неделю · заметок пока нет");
  });
});
