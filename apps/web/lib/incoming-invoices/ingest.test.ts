import { describe, expect, it } from "vitest";

import { classifyByName, kindFromFile, parseForwardedFrom } from "./classify";

describe("inbound classification", () => {
  it("parks statements and reminders", () => {
    expect(classifyByName("vypis-srpen.pdf")).toBe("statement");
    expect(classifyByName("upominka.pdf")).toBe("reminder");
    expect(classifyByName("zalohova-faktura.pdf")).toBe("proforma");
  });

  it("maps file kinds", () => {
    expect(kindFromFile("invoice.isdoc", "application/xml")).toBe("isdoc");
    expect(kindFromFile("doc.pdf", "application/pdf")).toBe("pdf");
  });
});

describe("forward parsing", () => {
  it("reads a Gmail-style forwarded From line", () => {
    expect(
      parseForwardedFrom(
        "---------- Forwarded message ----------\nFrom: dodavatel@example.com",
      ),
    ).toBe("dodavatel@example.com");
  });

  it("does not invent a sender on a direct mail", () => {
    expect(
      parseForwardedFrom("Hello, please find the invoice attached."),
    ).toBeNull();
  });
});
