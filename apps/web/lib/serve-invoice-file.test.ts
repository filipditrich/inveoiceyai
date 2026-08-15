import demoInvoice from "./demo-sample-invoice.json";
import { describe, expect, it } from "vitest";

import { serveInvoicePdf } from "./serve-invoice-file";

describe("serveInvoicePdf", () => {
  it("renders the frozen payload when a native issued invoice has no stored PDF", async () => {
    const response = await serveInvoicePdf(
      {
        artifactsImmutable: 0,
        importCompleteness: null,
        issuedAt: new Date("2026-08-15T16:28:00.000Z"),
        number: "20260117",
        payloadJson: demoInvoice,
        pdfUrl: null,
      } as never,
      "inline",
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline;");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("does not regenerate a missing immutable imported PDF", async () => {
    const response = await serveInvoicePdf({
      artifactsImmutable: 1,
      importCompleteness: "full",
      number: "external-1",
      payloadJson: {},
      pdfUrl: null,
    } as never);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "imported_pdf_missing",
    });
  });
});
