import { describe, expect, it } from "vitest";

import { generatorPathForLocale } from "./href";

describe("generatorPathForLocale", () => {
  it("keeps Czech SEO on the Czech slug", () => {
    expect(generatorPathForLocale("cs")).toBe("/faktura-zdarma");
  });

  it("keeps English SEO on the English slug", () => {
    expect(generatorPathForLocale("en")).toBe("/free-invoice-generator");
  });
});
