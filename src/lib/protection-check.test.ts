import { expect, test } from "vitest";

// Fails on purpose: proves that a pull request with a red test cannot reach main.
test("fails on purpose", () => {
  expect(1).toBe(2);
});
