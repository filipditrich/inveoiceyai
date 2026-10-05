import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import demoInvoice from "./demo-sample-invoice.json";
import {
  proxyStoredFile,
  serveInvoiceIsdoc,
  serveInvoicePdf,
} from "./serve-invoice-file";
import type { AddressInfo } from "node:net";

type InvoiceRow = Parameters<typeof serveInvoicePdf>[0];

const servers: Server[] = [];
const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);

async function upstream(handler: (response: ServerResponse) => void) {
  const server = createServer((_request, response) => handler(response));
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  // SAFETY: The listening event has fired for an IP-address TCP listener.
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/invoice`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }),
  );
});

describe("stored invoice downloads", () => {
  it.each(["before headers", "during the body"])(
    "returns a controlled failure when storage stalls %s",
    async (stage) => {
      // Shorten only the deadline; exercise native fetch, sockets and abort handling.
      vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
        nativeTimeout(100),
      );
      let closed = false;
      const url = await upstream((response) => {
        response.on("close", () => {
          closed = true;
        });
        if (stage === "during the body") response.write("%PDF-partial");
      });

      // SAFETY: The fixture includes every field read by the immutable-import branch.
      const response = await serveInvoicePdf({
        artifactsImmutable: 1,
        importCompleteness: "full",
        number: "external-1",
        payloadJson: {},
        pdfUrl: url,
      } as InvoiceRow);

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: "imported_pdf_unavailable",
      });
      await vi.waitFor(() => expect(closed).toBe(true));
    },
    2000,
  );

  it.each([
    { status: 503, headers: {}, message: "artifact fetch failed: 503" },
    {
      status: 200,
      headers: { "content-length": String(26 * 1024 * 1024) },
      message: "artifact exceeds size limit",
    },
  ])(
    "closes a rejected storage response ($message)",
    async ({ status, headers, message }) => {
      let closed = false;
      const url = await upstream((response) => {
        response.on("close", () => {
          closed = true;
        });
        response.writeHead(status, headers);
        response.write("unwanted response body");
      });

      await expect(
        proxyStoredFile(url, "invoice.pdf", "application/pdf"),
      ).rejects.toThrow(message);
      await vi.waitFor(() => expect(closed).toBe(true));
    },
  );

  it("stops an oversized chunked body even without a content-length header", async () => {
    let closed = false;
    const url = await upstream((response) => {
      response.on("close", () => {
        closed = true;
      });
      response.write(Buffer.alloc(25 * 1024 * 1024 + 1));
    });

    await expect(
      proxyStoredFile(url, "invoice.pdf", "application/pdf"),
    ).rejects.toThrow("artifact exceeds size limit");
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  it("never returns a partially downloaded invoice after a connection drops", async () => {
    const url = await upstream((response) => {
      response.write("%PDF-partial", () => response.destroy());
    });
    await expect(
      proxyStoredFile(url, "invoice.pdf", "application/pdf"),
    ).rejects.toThrow();
  });

  it.each([
    {
      serve: serveInvoicePdf,
      field: "pdfUrl",
      hashField: "pdfSha256",
      contentType: "application/pdf",
      extension: "pdf",
      bytes: "%PDF-1.7\noriginal frozen invoice",
      error: "issued_pdf_unavailable",
    },
    {
      serve: serveInvoiceIsdoc,
      field: "isdocUrl",
      hashField: "isdocSha256",
      contentType: "application/xml; charset=utf-8",
      extension: "isdoc",
      bytes: '<?xml version="1.0"?><Invoice>original</Invoice>',
      error: "issued_isdoc_unavailable",
    },
  ])(
    "serves intact stored $extension bytes and rejects an integrity mismatch",
    async ({
      serve,
      field,
      hashField,
      contentType,
      extension,
      bytes,
      error,
    }) => {
      const url = await upstream((response) => response.end(bytes));
      const row: Partial<InvoiceRow> = {
        artifactsImmutable: 0,
        importCompleteness: null,
        issuedAt: new Date("2026-08-15T16:28:00.000Z"),
        number: "20260117",
        payloadJson: demoInvoice,
        [field]: url,
        [hashField]: createHash("sha256").update(bytes).digest("hex"),
      };
      // SAFETY: The fixture includes every field read by stored native invoice delivery.
      const invoice = row as InvoiceRow;
      const response = await serve(invoice, "inline");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(contentType);
      expect(response.headers.get("content-disposition")).toContain(
        `faktura_20260117.${extension}`,
      );
      expect(response.headers.get("content-disposition")).toContain("inline;");
      expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(response.headers.get("cache-control")).toBe(
        "private, max-age=31536000, immutable",
      );
      expect(await response.text()).toBe(bytes);

      const corrupted = await serve({
        ...invoice,
        [hashField]: "0".repeat(64),
      });
      expect(corrupted.status).toBe(502);
      await expect(corrupted.json()).resolves.toEqual({ error });
    },
  );
});
