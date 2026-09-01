import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARTIFACT_FILENAME_TEMPLATE,
  invoiceArtifactFileNames,
  invoiceArtifactFileNamesFromInvoice,
  invoiceArtifactFilenameStem,
} from "./artifact-filenames";

describe("invoiceArtifactFileNames", () => {
  it("uses cs invoice kind by default", () => {
    expect(
      invoiceArtifactFileNames({ number: "2026001", language: "cs" }),
    ).toEqual({
      pdf: "faktura_2026001.pdf",
      isdoc: "faktura_2026001.isdoc",
    });
  });

  it("localizes en invoice and credit note", () => {
    expect(
      invoiceArtifactFileNames({
        number: "2026001",
        language: "en",
        docType: "invoice",
      }).pdf,
    ).toBe("invoice_2026001.pdf");
    expect(
      invoiceArtifactFileNames({
        number: "2026001",
        language: "en",
        docType: "credit_note",
      }).pdf,
    ).toBe("credit-note_2026001.pdf");
  });

  it("uses localized stems for each czech doc type", () => {
    expect(
      invoiceArtifactFilenameStem({
        number: "1",
        language: "cs",
        docType: "credit_note",
      }),
    ).toBe("dobropis_1");
    expect(
      invoiceArtifactFilenameStem({
        number: "1",
        language: "cs",
        docType: "proforma",
      }),
    ).toBe("proforma_1");
    expect(
      invoiceArtifactFilenameStem({
        number: "1",
        language: "cs",
        docType: "advance",
      }),
    ).toBe("zalohova_1");
  });

  it("sanitizes slashy invoice numbers", () => {
    expect(
      invoiceArtifactFileNames({
        number: "FV 2026/001",
        language: "cs",
      }).pdf,
    ).toBe("faktura_FV_2026_001.pdf");
  });

  it("applies a custom template and strips a trailing extension", () => {
    expect(
      invoiceArtifactFileNames({
        number: "2026001",
        language: "en",
        template: "invoice-{number}.pdf",
      }).pdf,
    ).toBe("invoice-2026001.pdf");
  });

  it("falls back to the default template when empty", () => {
    expect(
      invoiceArtifactFilenameStem({
        number: "2026001",
        language: "cs",
        template: "   ",
      }),
    ).toBe("faktura_2026001");
    expect(DEFAULT_ARTIFACT_FILENAME_TEMPLATE).toBe("{kind}_{number}");
  });

  it("reads number language and doc type from an invoice", () => {
    expect(
      invoiceArtifactFileNamesFromInvoice({
        meta: {
          number: "2026/9",
          language: "en",
          docType: "advance",
        },
      }).pdf,
    ).toBe("advance_2026_9.pdf");
  });
});
