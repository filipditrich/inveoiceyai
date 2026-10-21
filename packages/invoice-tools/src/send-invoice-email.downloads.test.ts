import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invoices, issuerBusinesses, emailSuppressions } from "@invoicey/db";
import { InvoiceSchema } from "@invoicey/invoice-core";

import type {
  SendTransactionalEmailInput,
  SendTransactionalEmailResult,
} from "./email-transport";
import { sendInvoiceEmailById } from "./send-invoice-email";
import type { AddressInfo } from "node:net";

type StoredInvoice = Pick<
  typeof invoices.$inferSelect,
  | "id"
  | "workspaceId"
  | "issuerId"
  | "issuedAt"
  | "cancelledAt"
  | "number"
  | "payloadJson"
  | "issueDate"
  | "dueDate"
  | "total"
  | "currency"
  | "clientName"
  | "pdfUrl"
  | "isdocUrl"
  | "pdfSha256"
  | "isdocSha256"
>;
const fixtures = vi.hoisted(() => {
  const rows: StoredInvoice[] = [];
  const transport =
    vi.fn<
      (
        input: SendTransactionalEmailInput,
      ) => Promise<SendTransactionalEmailResult>
    >();
  return { rows, transport };
});
function queryRows<T>(rows: T[]) {
  return { where: () => ({ limit: async () => rows }) };
}
vi.mock("@invoicey/db", async (original) => ({
  ...(await original<typeof import("@invoicey/db")>()),
  assertWorkspaceWritable: async () => undefined,
  tryCreateDbFromEnv: () => ({
    select: () => ({
      from: (
        table:
          | typeof invoices
          | typeof issuerBusinesses
          | typeof emailSuppressions,
      ) => {
        if (table === invoices) return queryRows(fixtures.rows);
        if (table === issuerBusinesses)
          return queryRows([{ emailSettings: { attachIsdocByDefault: true } }]);
        if (table === emailSuppressions) return queryRows([]);
        throw new Error("Unexpected database table");
      },
    }),
  }),
}));
vi.mock("./email-transport", async (original) => ({
  ...(await original<typeof import("./email-transport")>()),
  sendTransactionalEmail: fixtures.transport,
}));
const pdf = Buffer.from("%PDF-1.7\nstored invoice\n%%EOF\n");
const isdoc = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?><Invoice>Žluťoučký kůň</Invoice>',
);
const pdfHash =
  "12754e4b7d536d918f82c67221b9677249db2c80376015d558c1d6605d9700b0";
const isdocHash =
  "1610c336eb41ca4132db922e34a4fb50e592386027e3e09316bb0fb111d77fbb";
const workspaceId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
const servers: Server[] = [];
const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);

async function storage(handler?: (response: ServerResponse) => void) {
  const hits: string[] = [];
  let closed = false;
  const server = createServer((request, response) => {
    hits.push(request.url ?? "");
    response.on("close", () => {
      closed = true;
    });
    if (handler) return handler(response);
    response.end(request.url === "/invoice.pdf" ? pdf : isdoc);
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  // SAFETY: The listening event has fired for an IP-address TCP listener.
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  fixtures.rows[0]!.pdfUrl = `${origin}/invoice.pdf`;
  fixtures.rows[0]!.isdocUrl = `${origin}/invoice.isdoc`;
  return { hits, isClosed: () => closed };
}

beforeEach(() => {
  const invoice = InvoiceSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../invoice-core/src/__fixtures__/invoices/domestic-transfer.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  invoice.client.contactEmail = "recipient@example.test";
  fixtures.rows.splice(0, fixtures.rows.length, {
    id,
    workspaceId,
    issuerId: invoice.issuer.id,
    issuedAt: new Date(),
    cancelledAt: null,
    number: invoice.meta.number,
    payloadJson: { ...invoice },
    issueDate: invoice.meta.issueDate,
    dueDate: invoice.meta.dueDate,
    total: "1210",
    currency: "CZK",
    clientName: invoice.client.name,
    pdfUrl: null,
    isdocUrl: null,
    pdfSha256: pdfHash,
    isdocSha256: isdocHash,
  });
  fixtures.transport.mockReset().mockResolvedValue({
    messageId: "mail-demo",
    providerMessageId: "provider-demo",
    status: "sent",
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
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
const send = () =>
  sendInvoiceEmailById({ id, workspaceId, to: "recipient@example.test" });

describe("stored email attachments", () => {
  // Production bug: sending did not validate stored hashes, so altered documents reached transport.
  it.each(["pdfSha256", "isdocSha256"] as const)(
    "blocks sending when %s disagrees with storage",
    async (field) => {
      const upstream = await storage();
      fixtures.rows[0]![field] = "a".repeat(64);
      expect(await send()).toEqual({
        ok: false,
        error: "artifact integrity check failed",
      });
      expect(upstream.hits).toContain(
        field === "pdfSha256" ? "/invoice.pdf" : "/invoice.isdoc",
      );
      expect(fixtures.transport).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])(
    "delivers exact stored PDF and UTF-8 ISDOC bytes (hashes: %s)",
    async (hashed) => {
      await storage();
      if (!hashed) {
        fixtures.rows[0]!.pdfSha256 = null;
        fixtures.rows[0]!.isdocSha256 = null;
      }
      expect((await send()).ok).toBe(true);
      expect(fixtures.transport).toHaveBeenCalledTimes(1);
      expect(fixtures.transport.mock.calls[0]![0].attachments).toEqual([
        expect.objectContaining({
          content: pdf,
          contentType: "application/pdf",
        }),
        expect.objectContaining({
          content: isdoc,
          contentType: "application/xml",
        }),
      ]);
    },
  );
  // Production bug: unbounded fetch/arrayBuffer could hang an email request indefinitely.
  it.each(["before headers", "during body"])(
    "aborts stalled storage %s without sending",
    async (stage) => {
      vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
        nativeTimeout(100),
      );
      const upstream = await storage((response) => {
        if (stage === "during body") response.write("partial");
      });
      expect((await send()).ok).toBe(false);
      expect(fixtures.transport).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(upstream.isClosed()).toBe(true));
    },
    2000,
  );
  it.each(["declared", "chunked"])(
    "rejects %s oversized attachments before email transport",
    async (mode) => {
      const upstream = await storage((response) => {
        if (mode === "declared")
          response.setHeader("content-length", 26 * 1024 * 1024);
        response.write(
          mode === "declared" ? "partial" : Buffer.alloc(25 * 1024 * 1024 + 1),
        );
      });
      expect(await send()).toEqual({
        ok: false,
        error: "artifact exceeds size limit",
      });
      expect(fixtures.transport).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(upstream.isClosed()).toBe(true));
    },
    2000,
  );
});
