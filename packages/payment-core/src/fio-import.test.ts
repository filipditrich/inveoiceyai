import { describe, expect, it } from "vitest";

import {
  buildFioImportXml,
  classifyFioRail,
  parseFioImportResponse,
  splitFioImportBatches,
} from "./fio-import";

const domesticLine = {
  amount: "1210.00",
  currency: "CZK",
  beneficiaryName: "Dodavatel & Spol.",
  beneficiaryAccountNumber: "123456789",
  beneficiaryBankCode: "0100",
  variableSymbol: "2026001",
  messageForRecipient: "Faktura <test>",
  comment: "inv/abcd1234",
  rail: "domestic" as const,
};

describe("fio import xml", () => {
  it("emits domestic before T2 and escapes text", () => {
    const { xml } = buildFioImportXml({
      accountFrom: "2000145399/2010",
      currency: "CZK",
      executionDate: "2026-08-18",
      lines: [
        {
          ...domesticLine,
          rail: "sepa",
          beneficiaryIban: "DE89370400440532013000",
          beneficiaryName: "EU Supplier",
        },
        domesticLine,
      ],
    });
    expect(xml.indexOf("DomesticTransaction")).toBeLessThan(
      xml.indexOf("T2Transaction"),
    );
    expect(xml).toContain("Dodavatel &amp; Spol.");
    expect(xml).toContain("Faktura &lt;test&gt;");
    expect(xml).toContain("<paymentType>431001</paymentType>");
    expect(xml).toContain("<paymentType>431008</paymentType>");
  });

  it("classifies rails", () => {
    expect(classifyFioRail({ accountNumber: "1", bankCode: "0100" })).toBe(
      "domestic",
    );
    expect(classifyFioRail({ iban: "DE89370400440532013000" })).toBe("sepa");
    expect(classifyFioRail({ iban: "US64SVBKUS6S3300958879" })).toBe("foreign");
  });

  it("parses every documented errorCode", () => {
    expect(
      parseFioImportResponse("<errorCode>0</errorCode><status>ok</status>").ok,
    ).toBe(true);
    expect(
      parseFioImportResponse("<errorCode>2</errorCode><status>warning</status>")
        .ok,
    ).toBe(true);
    expect(
      parseFioImportResponse("<errorCode>1</errorCode><status>error</status>")
        .ok,
    ).toBe(false);
    expect(
      parseFioImportResponse("<errorCode>11</errorCode><status>error</status>")
        .ok,
    ).toBe(false);
    expect(parseFioImportResponse("<status>fatal</status>").ok).toBe(false);
  });

  it("splits when a batch would exceed 2 MB", () => {
    const huge = Array.from({ length: 80 }, (_, index) => ({
      ...domesticLine,
      messageForRecipient: "x".repeat(140),
      comment: "y".repeat(255),
      variableSymbol: String(index).padStart(10, "0"),
    }));
    const batches = splitFioImportBatches({
      accountFrom: "1",
      currency: "CZK",
      executionDate: "2026-08-18",
      lines: huge,
    });
    expect(batches.length).toBeGreaterThanOrEqual(1);
    for (const batch of batches) {
      expect(batch.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
    }
  });
});
