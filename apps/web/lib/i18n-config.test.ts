import {
  isAppLocale,
  negotiateLocale,
  toIntlLocale,
  toOgLocale,
} from "@/i18n/config";
import { describe, expect, it } from "vitest";

describe("negotiateLocale", () => {
  it("returns cs for null Accept-Language", () => {
    expect(negotiateLocale(null)).toBe("cs");
  });

  it("returns cs for empty string", () => {
    expect(negotiateLocale("")).toBe("cs");
  });

  it("returns cs when cs is highest quality", () => {
    expect(negotiateLocale("cs,en;q=0.8")).toBe("cs");
  });

  it("returns en when en is highest quality", () => {
    expect(negotiateLocale("en,cs;q=0.5")).toBe("en");
  });

  it("matches base tag from full BCP 47 (cs-CZ → cs)", () => {
    expect(negotiateLocale("cs-CZ,en;q=0.7")).toBe("cs");
  });

  it("matches base tag from full BCP 47 (en-US → en)", () => {
    expect(negotiateLocale("en-US,de;q=0.5")).toBe("en");
  });

  it("falls back to cs for unsupported languages", () => {
    expect(negotiateLocale("de,fr;q=0.9,ja;q=0.8")).toBe("cs");
  });

  it("respects quality ordering", () => {
    expect(negotiateLocale("de;q=1,en;q=0.9,cs;q=0.7")).toBe("en");
  });

  it("handles malformed quality gracefully", () => {
    expect(negotiateLocale("en;q=abc,cs;q=0.5")).toBe("cs");
  });
});

describe("isAppLocale", () => {
  it("returns true for cs", () => {
    expect(isAppLocale("cs")).toBe(true);
  });

  it("returns true for en", () => {
    expect(isAppLocale("en")).toBe(true);
  });

  it("returns false for unsupported locale", () => {
    expect(isAppLocale("de")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAppLocale(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAppLocale(undefined)).toBe(false);
  });
});

describe("toIntlLocale", () => {
  it("maps cs to cs-CZ", () => {
    expect(toIntlLocale("cs")).toBe("cs-CZ");
  });

  it("maps en to en-GB", () => {
    expect(toIntlLocale("en")).toBe("en-GB");
  });
});

describe("toOgLocale", () => {
  it("maps cs to cs_CZ", () => {
    expect(toOgLocale("cs")).toBe("cs_CZ");
  });

  it("maps en to en_GB", () => {
    expect(toOgLocale("en")).toBe("en_GB");
  });
});
