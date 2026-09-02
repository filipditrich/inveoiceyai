import { describe, expect, it } from "vitest";

import {
  MARKETING_HOME_HREF,
  appResourceLinks,
  docsChromeLinks,
} from "./public-nav";

describe("docsChromeLinks", () => {
  it("puts the marketing homepage ahead of Open app", () => {
    expect(docsChromeLinks()).toEqual([
      { text: "Home", url: MARKETING_HOME_HREF, kind: "main" },
      { text: "Open app", url: "/dashboard", kind: "button" },
    ]);
  });
});

describe("appResourceLinks", () => {
  it("includes the marketing homepage before docs", () => {
    expect(appResourceLinks("/invoices").map((item) => item.url)).toEqual([
      MARKETING_HOME_HREF,
      "/docs",
    ]);
  });

  it("marks home active only on the marketing root", () => {
    expect(
      appResourceLinks("/").find((item) => item.key === "home")?.isActive,
    ).toBe(true);
    expect(
      appResourceLinks("/dashboard").find((item) => item.key === "home")
        ?.isActive,
    ).toBe(false);
  });

  it("marks docs active on docs routes", () => {
    expect(
      appResourceLinks("/docs/integrations/cli").find(
        (item) => item.key === "docs",
      )?.isActive,
    ).toBe(true);
    expect(
      appResourceLinks("/").find((item) => item.key === "docs")?.isActive,
    ).toBe(false);
  });
});
