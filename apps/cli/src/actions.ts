import * as p from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pc from "picocolors";

import { flagBool, flagString } from "./args";
import { CompanionClient, CompanionError } from "./client";
import { clearConfig, saveConfig, type CliConfig } from "./config";
import {
  brand,
  money,
  muted,
  ok,
  pad,
  printError,
  printInvoiceTable,
  printJson,
  type InvoiceRow,
} from "./print";
import type { Ctx } from "./types";
import { wizardCreate } from "./wizard";

export type { Ctx };

function asRows(value: unknown): InvoiceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is InvoiceRow => {
    return Boolean(row && typeof row === "object" && "id" in row);
  });
}

async function confirmAction(ctx: Ctx, message: string): Promise<boolean> {
  if (ctx.yes) return true;
  if (!process.stdin.isTTY) {
    printError("refusing to continue without --yes (not a TTY)");
    return false;
  }
  const value = await p.confirm({ message });
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    return false;
  }
  return value === true;
}

export async function cmdLogin(cfg: CliConfig): Promise<number> {
  p.intro(brand("Invoicey"));
  const token = await p.password({
    message: "Personal API key (Settings → API keys)",
    validate: (v) => (v.trim().length > 8 ? undefined : "Key looks too short"),
  });
  if (p.isCancel(token)) {
    p.cancel("Cancelled.");
    return 1;
  }
  const apiUrl =
    (await p.text({
      message: "API URL",
      initialValue: cfg.apiUrl,
    })) ?? cfg.apiUrl;
  if (p.isCancel(apiUrl)) {
    p.cancel("Cancelled.");
    return 1;
  }
  const host = String(apiUrl).replace(/\/$/, "");
  const client = new CompanionClient(host, String(token).trim());
  try {
    const me = await client.op({ op: "me" });
    client.requireOk(me);
    const path = await saveConfig({
      apiUrl: host,
      token: String(token).trim(),
    });
    p.outro(
      `${ok("Saved")}  ${String(me.workspaceName ?? me.workspaceId)}  ${muted(path)}`,
    );
    return 0;
  } catch (err) {
    const message = err instanceof CompanionError ? err.message : String(err);
    p.log.error(message);
    p.cancel("Login failed.");
    return 1;
  }
}

export async function cmdLogout(): Promise<number> {
  await clearConfig();
  process.stdout.write(`${ok("Logged out.")}\n`);
  return 0;
}

export async function cmdWhoami(ctx: Ctx): Promise<number> {
  const me = ctx.client.requireOk(await ctx.client.op({ op: "me" }));
  if (ctx.json) {
    printJson(me);
    return 0;
  }
  process.stdout.write(
    `${brand("Invoicey")}  ${me.workspaceName ?? me.workspaceId}\n`,
  );
  process.stdout.write(
    `${muted("workspace")}  ${String(me.workspaceId)}\n${muted("auth")}       ${String(me.kind)}\n`,
  );
  return 0;
}

export async function cmdStatus(ctx: Ctx): Promise<number> {
  const data = ctx.client.requireOk(await ctx.client.op({ op: "status" }));
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const counts = (data.counts ?? {}) as Record<string, number>;
  const outstanding = (data.outstanding ?? {}) as Record<string, number>;
  process.stdout.write(`${brand("Workspace status")}\n`);
  const keys = ["overdue", "unpaid", "draft", "future", "paid", "cancelled"];
  process.stdout.write(
    keys.map((k) => `${pc.bold(String(counts[k] ?? 0))} ${k}`).join("  ·  ") +
      "\n",
  );
  const moneyBits = Object.entries(outstanding).map(([c, n]) => money(n, c));
  if (moneyBits.length > 0) {
    process.stdout.write(`${muted("outstanding")}  ${moneyBits.join("  ")}\n`);
  }
  return 0;
}

export async function cmdInvoiceList(ctx: Ctx): Promise<number> {
  const limitRaw = flagString(ctx.flags, "limit");
  const data = ctx.client.requireOk(
    await ctx.client.op({
      op: "invoices.list",
      limit: limitRaw ? Number(limitRaw) : 25,
      unpaidOnly: flagBool(ctx.flags, "unpaid"),
      q: flagString(ctx.flags, "q"),
    }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  printInvoiceTable(asRows(data.invoices));
  return 0;
}

export async function cmdInvoiceShow(ctx: Ctx, ref: string): Promise<number> {
  const data = ctx.client.requireOk(
    await ctx.client.op({ op: "invoices.get", ref }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const summary = data.summary as InvoiceRow | undefined;
  const invoice = data.invoice as
    | {
        items?: Array<{
          description: string;
          quantity: number;
          unit: string;
          unitPriceWithoutVat: number;
          vatRate: number;
          lineTotal: number;
        }>;
        totals?: { total: number };
        client?: { name: string; ico?: string };
        meta?: { number: string; issueDate: string; dueDate: string };
      }
    | undefined;
  if (!summary) {
    printError("invoice payload missing");
    return 1;
  }
  process.stdout.write(
    `${brand(summary.number ?? "draft")}  ${summary.clientName}  ${money(summary.total, summary.currency)}  ${summary.displayStatus ?? summary.status}\n`,
  );
  process.stdout.write(
    `${muted(summary.id)}\n${muted(`due ${summary.dueDate}`)}\n`,
  );
  if (invoice?.client?.ico) {
    process.stdout.write(`${muted("IČO")}  ${invoice.client.ico}\n`);
  }
  for (const line of invoice?.items ?? []) {
    process.stdout.write(
      `  ${line.quantity} ${line.unit}  ${line.description}  ${money(line.lineTotal, summary.currency)}  (${line.vatRate} %)\n`,
    );
  }
  return 0;
}

export async function cmdInvoiceNew(ctx: Ctx): Promise<number> {
  const ico = flagString(ctx.flags, "ico");
  const clientId = flagString(ctx.flags, "client");
  const desc = flagString(ctx.flags, "desc");
  if (!desc || (!ico && !clientId)) {
    if (process.stdin.isTTY) return wizardCreate(ctx);
    printError("need --client or --ico, and --desc (or run in a TTY)");
    return 1;
  }
  const created = ctx.client.requireOk(
    await ctx.client.op({
      op: "invoices.create",
      clientId,
      ico,
      draft: {
        items: [
          {
            description: desc,
            quantity: Number(flagString(ctx.flags, "qty") ?? "1"),
            unit: flagString(ctx.flags, "unit") ?? "ks",
            unitPriceWithoutVat: Number(flagString(ctx.flags, "price") ?? "0"),
            vatRate: Number(flagString(ctx.flags, "vat") ?? "21"),
          },
        ],
      },
    }),
  );
  if (ctx.json) {
    printJson(created);
    return 0;
  }
  process.stdout.write(
    `${ok("draft")}  ${String(created.number ?? created.invoiceId)}\n`,
  );
  return 0;
}

async function mutate(
  ctx: Ctx,
  ref: string,
  op: string,
  label: string,
  extra: Record<string, unknown> = {},
): Promise<number> {
  if (!(await confirmAction(ctx, `${label} ${ref}?`))) return 1;
  const data = ctx.client.requireOk(await ctx.client.op({ op, ref, ...extra }));
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  process.stdout.write(`${ok(label)}  ${ref}\n`);
  return 0;
}

export async function cmdInvoiceIssue(ctx: Ctx, ref: string): Promise<number> {
  return mutate(ctx, ref, "invoices.issue", "issue");
}

export async function cmdInvoiceSend(ctx: Ctx, ref: string): Promise<number> {
  return mutate(ctx, ref, "invoices.send", "send", {
    to: flagString(ctx.flags, "to"),
  });
}

export async function cmdInvoicePaid(ctx: Ctx, ref: string): Promise<number> {
  return mutate(ctx, ref, "invoices.paid", "mark paid");
}

export async function cmdInvoiceUnpaid(ctx: Ctx, ref: string): Promise<number> {
  return mutate(ctx, ref, "invoices.unpaid", "unmark paid");
}

export async function cmdInvoiceCancel(ctx: Ctx, ref: string): Promise<number> {
  return mutate(ctx, ref, "invoices.cancel", "cancel");
}

export async function cmdInvoiceDownload(
  ctx: Ctx,
  ref: string,
  kind: "pdf" | "isdoc",
): Promise<number> {
  const file = await ctx.client.download(ref, kind);
  const dest = resolve(flagString(ctx.flags, "output") ?? file.filename);
  await writeFile(dest, file.bytes);
  if (ctx.json) {
    printJson({ ok: true, path: dest, bytes: file.bytes.byteLength });
    return 0;
  }
  process.stdout.write(`${ok("wrote")}  ${dest}\n`);
  return 0;
}

export async function cmdClients(ctx: Ctx): Promise<number> {
  const data = ctx.client.requireOk(
    await ctx.client.op({ op: "clients.list" }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const rows = Array.isArray(data.clients)
    ? (data.clients as Array<{
        id: string;
        name: string;
        ico: string | null;
        city: string | null;
      }>)
    : [];
  if (rows.length === 0) {
    process.stdout.write(`${muted("No clients.")}\n`);
    return 0;
  }
  for (const row of rows) {
    process.stdout.write(
      `${pad(row.ico ?? "—", 12)}${pad(row.name, 36)}${row.city ?? ""}\n`,
    );
  }
  return 0;
}

export async function cmdClientAdd(ctx: Ctx, ico: string): Promise<number> {
  const data = ctx.client.requireOk(
    await ctx.client.op({ op: "clients.add", ico }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const snap = data.snapshot as { name?: string } | undefined;
  process.stdout.write(
    `${ok(data.existing ? "exists" : "added")}  ${snap?.name ?? data.clientId}\n`,
  );
  return 0;
}

export async function cmdIssuers(ctx: Ctx): Promise<number> {
  const data = ctx.client.requireOk(
    await ctx.client.op({ op: "issuers.list" }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const rows = Array.isArray(data.issuers)
    ? (data.issuers as Array<{
        id: string;
        isDefault: boolean;
        name: string;
        ico: string;
      }>)
    : [];
  for (const row of rows) {
    const mark = row.isDefault ? brand("*") : " ";
    process.stdout.write(`${mark} ${row.ico}  ${row.name}\n`);
  }
  return 0;
}

export async function cmdPayments(ctx: Ctx): Promise<number> {
  const data = ctx.client.requireOk(
    await ctx.client.op({ op: "payments.proposals" }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  const rows = Array.isArray(data.proposals)
    ? (data.proposals as Array<{
        id: string;
        amount: string;
        currency: string;
        invoiceNumber: string | null;
        clientName: string;
        confidence: string;
        counterpartyName: string | null;
        bookedDate: string;
      }>)
    : [];
  if (rows.length === 0) {
    process.stdout.write(`${muted("No pending match proposals.")}\n`);
    return 0;
  }
  for (const row of rows) {
    process.stdout.write(
      `${row.id}\n  ${row.bookedDate}  ${money(row.amount, row.currency)}  ${row.confidence}  → ${row.invoiceNumber ?? row.clientName}  ${muted(row.counterpartyName ?? "")}\n`,
    );
  }
  return 0;
}

export async function cmdPaymentReview(
  ctx: Ctx,
  id: string,
  op: "payments.confirm" | "payments.reject",
): Promise<number> {
  const label = op === "payments.confirm" ? "confirm match" : "reject match";
  if (!(await confirmAction(ctx, `${label} ${id}?`))) return 1;
  const data = ctx.client.requireOk(
    await ctx.client.op({ op, proposalId: id }),
  );
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  process.stdout.write(`${ok(label)}  ${id}\n`);
  return 0;
}

export async function cmdAres(ctx: Ctx, query: string): Promise<number> {
  const digits = query.replaceAll(/\s/g, "");
  const data = /^\d{8}$/.test(digits)
    ? ctx.client.requireOk(
        await ctx.client.op({ op: "ares.lookup", ico: digits }),
      )
    : ctx.client.requireOk(await ctx.client.op({ op: "ares.search", query }));
  if (ctx.json) {
    printJson(data);
    return 0;
  }
  if (data.draft && typeof data.draft === "object") {
    const d = data.draft as { name?: string; ico?: string };
    process.stdout.write(`${d.ico ?? digits}  ${d.name ?? ""}\n`);
    return 0;
  }
  const matches = Array.isArray(data.matches) ? data.matches : [];
  for (const m of matches) {
    if (m && typeof m === "object") {
      const row = m as { ico?: string; name?: string };
      process.stdout.write(`${row.ico ?? ""}  ${row.name ?? ""}\n`);
    }
  }
  return 0;
}

export { CompanionError };
