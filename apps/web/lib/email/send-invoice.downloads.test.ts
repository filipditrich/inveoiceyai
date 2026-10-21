import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, expect, it, vi } from "vitest";

import { invoices, issuerBusinesses, type InvoiceyDb } from "@invoicey/db";
import { InvoiceSchema } from "@invoicey/invoice-core";

import demoInvoice from "../demo-sample-invoice.json";
import { sendOverdueReminderForInvoice } from "./send-invoice";
import type { AddressInfo } from "node:net";

vi.mock("server-only", () => ({}));
const transport = vi.hoisted(() => vi.fn());
vi.mock("@invoicey/invoice-tools/email", async (original) => ({
  ...(await original<typeof import("@invoicey/invoice-tools/email")>()),
  isEmailSuppressed: async () => false,
  wasRecentlyReminded: async () => false,
  sendTransactionalEmail: transport,
}));
afterEach(() => {
  vi.restoreAllMocks();
  transport.mockReset();
});

// Production bug: attachment failures escaped the reminder result and aborted the cron loop.
it("returns a failed reminder without calling mail transport when storage is unavailable", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(503);
    response.end("storage unavailable");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    // SAFETY: The listening event has fired for an IP-address TCP listener.
    const address = server.address() as AddressInfo;
    const invoice = InvoiceSchema.parse(demoInvoice);
    invoice.client.contactEmail = "recipient@example.test";
    const row = {
      id: "00000000-0000-4000-8000-000000000002",
      issuerId: invoice.issuer.id,
      issuedAt: new Date(),
      cancelledAt: null,
      paidAt: null,
      payloadJson: invoice,
      number: invoice.meta.number,
      issueDate: invoice.meta.issueDate,
      dueDate: invoice.meta.dueDate,
      total: String(invoice.totals.total),
      currency: invoice.meta.currency,
      clientName: invoice.client.name,
      pdfUrl: `http://127.0.0.1:${address.port}/invoice.pdf`,
      isdocUrl: null,
    };
    const database = {
      select: () => ({
        from: (table: typeof invoices | typeof issuerBusinesses) => ({
          where: () => ({
            limit: async () =>
              table === invoices
                ? [row]
                : [{ emailSettings: { overdueRemindersEnabled: true } }],
          }),
        }),
      }),
    };
    const result = await sendOverdueReminderForInvoice({
      // SAFETY: The fixture implements the select/from/where/limit path used by this operation.
      // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- This partial query-builder fixture deliberately cannot contact a database.
      db: database as unknown as InvoiceyDb,
      workspaceId: "00000000-0000-4000-8000-000000000001",
      invoiceId: row.id,
    });
    expect(result).toEqual({ ok: false, error: "artifact fetch failed: 503" });
    expect(transport).not.toHaveBeenCalled();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
