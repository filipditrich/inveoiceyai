import { describe, expect, it } from "vitest";

import demoInvoice from "./demo-sample-invoice.json";
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
    expect(response.headers.get("content-disposition")).toContain(
      "faktura_20260117.pdf",
    );
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'self'",
    );
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("keeps attachment downloads protected from framing", async () => {
    const response = await serveInvoicePdf({
      artifactsImmutable: 0,
      importCompleteness: null,
      issuedAt: new Date("2026-08-15T16:28:00.000Z"),
      number: "20260117",
      payloadJson: demoInvoice,
      pdfUrl: null,
    } as never);

    expect(response.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBeNull();
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
