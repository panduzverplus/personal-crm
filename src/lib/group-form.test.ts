import { describe, expect, it } from "vitest";
import { parseGroupName } from "./group-form";

describe("parseGroupName", () => {
  it("returns the name", () => {
    expect(parseGroupName("Теннис")).toEqual({ ok: true, name: "Теннис" });
  });

  it("trims spaces around the name", () => {
    expect(parseGroupName("  Коллеги  ")).toEqual({
      ok: true,
      name: "Коллеги",
    });
  });

  it("keeps spaces inside the name", () => {
    expect(parseGroupName("Большой  теннис")).toEqual({
      ok: true,
      name: "Большой  теннис",
    });
  });

  it("asks for a name when it is empty", () => {
    expect(parseGroupName("")).toEqual({ ok: false, error: "Укажите название" });
  });

  it("asks for a name when there are only spaces", () => {
    expect(parseGroupName("   ")).toEqual({
      ok: false,
      error: "Укажите название",
    });
  });

  it("asks for a name when the form value is missing or not text", () => {
    expect(parseGroupName(null)).toEqual({
      ok: false,
      error: "Укажите название",
    });
    expect(parseGroupName(new File([], "a.txt"))).toEqual({
      ok: false,
      error: "Укажите название",
    });
  });

  it("accepts exactly 50 characters", () => {
    const name = "а".repeat(50);
    expect(parseGroupName(name)).toEqual({ ok: true, name });
  });

  it("rejects 51 characters", () => {
    expect(parseGroupName("а".repeat(51))).toEqual({
      ok: false,
      error: "Название не длиннее 50 символов",
    });
  });

  it("counts the length after trimming", () => {
    const name = "а".repeat(50);
    expect(parseGroupName(`  ${name}  `)).toEqual({ ok: true, name });
  });
});
