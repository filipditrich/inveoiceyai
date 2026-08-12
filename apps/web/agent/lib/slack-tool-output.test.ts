import { describe, expect, it } from "vitest";

import { toolOutputSnippet } from "./slack-tool-output";

describe("toolOutputSnippet", () => {
  it("summarizes ARES search matches instead of ok", () => {
    expect(
      toolOutputSnippet("search_business", {
        ok: true,
        query: "NFCtron",
        total: 2,
        matches: [
          {
            ico: "27074358",
            name: "NFCtron a.s.",
            dic: "CZ27074358",
            addressText: "Rohanské nábřeží 678/23, Praha, 186 00",
          },
          {
            ico: "12345678",
            name: "NFCtron s.r.o.",
            addressText: "Brno",
          },
        ],
      }),
    ).toBe(
      "2 ARES matches: NFCtron a.s. (27074358); NFCtron s.r.o. (12345678)",
    );
  });

  it("summarizes a single ARES lookup draft", () => {
    expect(
      toolOutputSnippet("lookup_business", {
        ok: true,
        draft: {
          name: "NFCtron a.s.",
          ico: "27074358",
          dic: "CZ27074358",
          address: {
            street: "Rohanské nábřeží 678/23",
            city: "Praha",
            zip: "18600",
            country: "CZ",
          },
        },
      }),
    ).toBe(
      "NFCtron a.s. · IČO 27074358 · DIČ CZ27074358 · Rohanské nábřeží 678/23 · Praha · 18600",
    );
  });

  it("uses ARES message on failure instead of error", () => {
    expect(
      toolOutputSnippet("lookup_business", {
        ok: false,
        kind: "not_found",
        message: "IČO 00000000 was not found in ARES",
      }),
    ).toBe("not_found: IČO 00000000 was not found in ARES");
  });

  it("summarizes draft invoice create", () => {
    expect(
      toolOutputSnippet("create_invoice", {
        ok: true,
        number: "2026-001",
        clientName: "NFCtron a.s.",
        total: "48400.00",
        currency: "CZK",
        uploadedToSlack: true,
      }),
    ).toBe("Draft 2026-001 · NFCtron a.s. · 48400.00 CZK · uploaded to Slack");
  });

  it("summarizes validation issues", () => {
    expect(
      toolOutputSnippet("create_invoice", {
        ok: false,
        issues: [
          { path: "issuer.contactEmail", message: "Required" },
          { path: "vat.mode", message: "Invalid enum value" },
        ],
      }),
    ).toBe(
      "Needs input: issuer.contactEmail: Required; vat.mode: Invalid enum value",
    );
  });

  it("summarizes a single ARES search hit with address", () => {
    expect(
      toolOutputSnippet("search_business", {
        ok: true,
        total: 1,
        matches: [
          {
            ico: "27074358",
            name: "NFCtron a.s.",
            addressText: "Praha",
          },
        ],
      }),
    ).toBe("NFCtron a.s. · IČO 27074358 · Praha");
  });

  it("does not return bare ok or error", () => {
    expect(
      toolOutputSnippet("search_business", { ok: true, matches: [] }),
    ).toBe("No ARES matches");
    expect(toolOutputSnippet("lookup_business", "ok")).toBeUndefined();
    expect(toolOutputSnippet("lookup_business", { ok: false })).toBe("Failed");
  });
});
