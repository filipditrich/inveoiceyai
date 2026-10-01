import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { z } from "zod";

import type {
  CallToolResult,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
const query = new URLSearchParams(location.search);
const invoice = {
  meta: {
    number: "DRAFT",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    currency: "CZK",
  },
  issuer: {
    name: "Studio Novák",
    ico: "12345678",
    address: {
      street: "Dlouhá 12",
      city: "Praha",
      zip: "11000",
      country: "CZ",
    },
  },
  client: {
    name: "Ateliér Forma",
    contactEmail: "billing@example.test",
    address: { street: "Údolní 8", city: "Brno", zip: "60200", country: "CZ" },
  },
  items: [
    {
      description: "Návrh vizuální identity",
      quantity: 12,
      unit: "hod",
      unitPriceWithoutVat: 1500,
      vatRate: 21,
      lineTotal: 21780,
    },
  ],
  totals: { subtotal: 18000, vatTotal: 3780, total: 21780 },
};
const rows = [
  {
    id: "fa636ada-7b43-4667-8719-f4b0ea73f634",
    number: null,
    clientName: "Ateliér Forma",
    total: "21780",
    currency: "CZK",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    status: "draft",
    displayStatus: "draft",
  },
  {
    id: "11e3a1ba-0610-4cb6-8eae-31d0f1daa8fe",
    number: "20260042",
    clientName: "Kavárna Mezi řádky",
    total: "12500",
    currency: "CZK",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    status: "issued",
    displayStatus: "overdue",
  },
  {
    id: "55e3a1ba-0610-4cb6-8eae-31d0f1daa8fe",
    number: "20260041",
    clientName: "North Design",
    total: "1450",
    currency: "EUR",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    status: "paid",
    displayStatus: "paid",
  },
];
const calls: Array<CallToolRequest["params"]> = [];
Object.assign(window, { calls });
const frame = document.querySelector<HTMLIFrameElement>("iframe")!;
const bridge = new AppBridge(
  null,
  { name: "Invoicey test host", version: "1" },
  { serverTools: {}, openLinks: {}, updateModelContext: {}, message: {} },
);
bridge.setHostContext({
  theme: query.get("theme") === "dark" ? "dark" : "light",
  locale: query.get("locale") ?? "cs",
  displayMode: "fullscreen",
  availableDisplayModes: ["inline", "fullscreen"],
});
const permissions = query.has("viewer")
  ? ["invoices:read"]
  : [
      "invoices:read",
      "invoices:create",
      "invoices:issue",
      "invoices:send",
      "payments:manage",
    ];
function result(payload: NonNullable<CallToolResult["structuredContent"]>) {
  return {
    content: [],
    structuredContent: payload,
    _meta: { appUrl: "https://invoicey.app", permissions },
  };
}
bridge.oncalltool = async (params) => {
  calls.push(params);
  if (query.has("error") && calls.length === 1)
    return {
      content: [{ type: "text", text: "fixture failure" }],
      isError: true,
    };
  const args = params.arguments ?? {};
  if (params.name === "list_invoices")
    return result({
      ok: true,
      invoices: rows.filter(
        (row) =>
          (!args.query ||
            row.clientName
              .toLowerCase()
              .includes(z.string().parse(args.query).toLowerCase())) &&
          (!args.unpaidOnly || row.displayStatus === "overdue"),
      ),
      nextOffset: null,
    });
  const row = rows.find((row) => row.id === args.id);
  if (!row) return result({ ok: false, error: "not_found" });
  if (params.name === "issue_invoice") {
    row.number = "20260043";
    row.status = "issued";
    row.displayStatus = "future";
  }
  if (params.name === "mark_invoice_paid") {
    row.status = "paid";
    row.displayStatus = "paid";
  }
  if (params.name === "get_invoice")
    return result({
      ok: true,
      summary: row,
      invoice: {
        ...invoice,
        client: { ...invoice.client, name: row.clientName },
      },
    });
  return result({ ok: true, summary: row });
};
bridge.onupdatemodelcontext = async (context) => {
  Object.assign(window, { attachedContext: context });
  return {};
};
bridge.onmessage = async (message) => {
  Object.assign(window, { lastMessage: message });
  return {};
};
bridge.onopenlink = async (link) => {
  Object.assign(window, { openedLink: link });
  return {};
};
bridge.onrequestdisplaymode = async ({ mode }) => ({ mode });
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(
    result({ ok: true, invoices: rows, nextOffset: null }),
  );
};
await bridge.connect(
  new PostMessageTransport(frame.contentWindow!, frame.contentWindow!),
);
frame.src = "/widget";
