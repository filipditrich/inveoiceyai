import { describe, expect, it } from "vitest";

import {
  importHrefForOrigin,
  MIGRATION_PROVIDERS,
  originFromQuery,
} from "./migration-providers";
import {
  isWelcomePath,
  welcomeBankIsComplete,
  welcomeIdentityViewFromName,
  welcomeSetupIndex,
  welcomeStepLabelKey,
} from "./welcome-flow";

describe("isWelcomePath", () => {
  it("matches the welcome route and its query-bearing children", () => {
    expect(isWelcomePath("/welcome")).toBe(true);
    expect(isWelcomePath("/welcome/")).toBe(true);
  });

  it("leaves the rest of the app on the full chrome", () => {
    expect(isWelcomePath("/dashboard")).toBe(false);
    expect(isWelcomePath("/onboarding")).toBe(false);
    expect(isWelcomePath("/invoices/welcome")).toBe(false);
  });
});

describe("welcomeSetupIndex", () => {
  it("counts the four fillable steps", () => {
    expect(welcomeSetupIndex("workspace")).toBe(1);
    expect(welcomeSetupIndex("identity")).toBe(2);
    expect(welcomeSetupIndex("bank")).toBe(3);
    expect(welcomeSetupIndex("migrate")).toBe(4);
    expect(welcomeSetupIndex("done")).toBe(4);
  });
});

describe("welcomeStepLabelKey", () => {
  it("maps migrate onto the history label", () => {
    expect(welcomeStepLabelKey("migrate")).toBe("history");
    expect(welcomeStepLabelKey("done")).toBe("history");
  });
});

describe("welcomeIdentityViewFromName", () => {
  it("keeps an empty recovery on the path choice", () => {
    expect(welcomeIdentityViewFromName("")).toBe("path");
    expect(welcomeIdentityViewFromName("   ")).toBe("path");
  });

  it("opens details when a business name was already recovered", () => {
    expect(welcomeIdentityViewFromName("Alza.cz a.s.")).toBe("details");
  });
});

describe("welcomeBankIsComplete", () => {
  it("requires both account and IBAN", () => {
    expect(
      welcomeBankIsComplete("19-123/0800", "CZ9708000000001920014539"),
    ).toBe(true);
    expect(welcomeBankIsComplete("19-123/0800", "")).toBe(false);
  });
});

describe("migration providers", () => {
  it("lists file-live tools and keeps Connect locked", () => {
    expect(MIGRATION_PROVIDERS.every((p) => p.files === "live")).toBe(true);
    expect(MIGRATION_PROVIDERS.every((p) => p.connect === "locked")).toBe(true);
    expect(MIGRATION_PROVIDERS.some((p) => p.id === "fakturoid")).toBe(true);
    expect(MIGRATION_PROVIDERS.some((p) => p.id === "iucto")).toBe(true);
  });

  it("builds the import deep link and ignores unknown origin query", () => {
    expect(importHrefForOrigin("fakturoid")).toBe(
      "/invoices/import?origin=fakturoid",
    );
    expect(originFromQuery("fakturoid")).toBe("fakturoid");
    expect(originFromQuery("not-a-tool")).toBeNull();
  });
});
