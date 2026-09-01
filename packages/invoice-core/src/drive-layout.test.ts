import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRIVE_LAYOUT_TEMPLATE,
  applyDriveLayout,
  disambiguateDriveTitles,
  parseDriveLayoutTemplate,
  resolveDriveLayoutTemplate,
  sanitizeDriveSegment,
} from "./drive-layout";

describe("parseDriveLayoutTemplate", () => {
  it("accepts the default year folder template", () => {
    expect(parseDriveLayoutTemplate("{year}/{kind}_{number}")).toEqual({
      ok: true,
      template: "{year}/{kind}_{number}",
    });
  });

  it("accepts a flat year prefix using {name}", () => {
    expect(parseDriveLayoutTemplate("{year}_{name}")).toEqual({
      ok: true,
      template: "{year}_{name}",
    });
  });

  it("rejects a template without number or name", () => {
    expect(parseDriveLayoutTemplate("{year}/{client}")).toEqual({
      ok: false,
      error: "missing_number",
    });
  });

  it("rejects unknown tokens and parent traversal", () => {
    expect(parseDriveLayoutTemplate("{foo}_{number}")).toEqual({
      ok: false,
      error: "unknown_token",
    });
    expect(parseDriveLayoutTemplate("../{number}")).toEqual({
      ok: false,
      error: "dotdot",
    });
  });

  it("falls back to the default when empty", () => {
    expect(resolveDriveLayoutTemplate("  ")).toBe(
      DEFAULT_DRIVE_LAYOUT_TEMPLATE,
    );
  });
});

describe("applyDriveLayout", () => {
  it("builds a year folder for a czech invoice", () => {
    expect(
      applyDriveLayout({
        issueDate: "2026-03-15",
        number: "2026001",
        language: "cs",
        docType: "invoice",
      }),
    ).toEqual({
      relPath: "2026/faktura_2026001",
      stem: "faktura_2026001",
      pdf: "2026/faktura_2026001.pdf",
      isdoc: "2026/faktura_2026001.isdoc",
    });
  });

  it("flattens {year}_{name} without a year folder", () => {
    expect(
      applyDriveLayout({
        template: "{year}_{name}",
        issueDate: "2026-09-01",
        number: "2026001",
        language: "cs",
      }).pdf,
    ).toBe("2026_faktura_2026001.pdf");
  });

  it("sanitizes client names used as folders", () => {
    expect(
      applyDriveLayout({
        template: "{year}/{client}/{name}",
        issueDate: "2026-01-02",
        number: "9",
        language: "en",
        docType: "invoice",
        clientName: "NFCtron a.s. / Pay",
      }).relPath,
    ).toBe("2026/NFCtron a.s. Pay/invoice_9");
  });
});

describe("sanitizeDriveSegment", () => {
  it("strips slashes and empty dots", () => {
    expect(sanitizeDriveSegment("../secret")).toBe("secret");
    expect(sanitizeDriveSegment("")).toBe("invoice");
  });
});

describe("disambiguateDriveTitles", () => {
  it("leaves unique names alone and suffixes clashes", () => {
    const titles = disambiguateDriveTitles([
      { id: "a", name: "Filip's Workspace" },
      { id: "b", name: "Sandbox" },
      { id: "c", name: "Filip's Workspace" },
    ]);
    expect(titles.get("a")).toBe("Filip's Workspace (1)");
    expect(titles.get("b")).toBe("Sandbox");
    expect(titles.get("c")).toBe("Filip's Workspace (2)");
  });
});
