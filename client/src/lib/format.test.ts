import { formatDate, formatDateTime, formatMoney, initials, truncate } from "./format";

describe("formatMoney", () => {
  it("formats in the given locale and currency, without needless decimals", () => {
    expect(formatMoney(9, "usd", "en-US")).toBe("$9");
    expect(formatMoney(9.5, "usd", "en-US")).toBe("$9.50");
    expect(formatMoney(1200, "jpy", "en-US")).toBe("¥1,200");
    expect(formatMoney(9, "eur", "de-DE")).toMatch(/^9\s€$/);
  });
});

describe("formatDate", () => {
  it("formats ISO strings", () => {
    expect(formatDate("2026-03-04T10:00:00.000Z")).toMatch(/Mar 4, 2026/);
  });
  it("returns empty string for invalid input", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("adds an ellipsis when too long", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Alice Example")).toBe("AE");
  });
  it("handles single names and empties", () => {
    expect(initials("Alice")).toBe("A");
    expect(initials("")).toBe("?");
    expect(initials(undefined, "U")).toBe("U");
  });
});

describe("formatDateTime", () => {
  it("adds the time and ignores invalid input", () => {
    expect(formatDateTime("2026-10-04T10:05:00Z", "en-US")).toMatch(/Oct 4, 2026, \d{1,2}:\d{2}/);
    expect(formatDateTime("nope")).toBe("");
  });
});
