import * as p from "@clack/prompts";

import {
  cmdAres,
  cmdClientAdd,
  cmdClients,
  cmdInvoiceDownload,
  cmdInvoiceIssue,
  cmdInvoiceList,
  cmdInvoiceNew,
  cmdInvoicePaid,
  cmdInvoiceSend,
  cmdInvoiceShow,
  cmdIssuers,
  cmdPaymentReview,
  cmdPayments,
  cmdStatus,
  cmdWhoami,
} from "./actions";
import { brand, muted } from "./print";
import type { Ctx } from "./types";

async function pickRef(message: string): Promise<string | null> {
  const ref = await p.text({ message });
  if (p.isCancel(ref) || String(ref).trim() === "") return null;
  return String(ref).trim();
}

async function invoicesMenu(ctx: Ctx): Promise<void> {
  const choice = await p.select({
    message: "Invoices",
    options: [
      { value: "list", label: "List" },
      { value: "unpaid", label: "Unpaid only" },
      { value: "show", label: "Show one" },
      { value: "new", label: "New draft" },
      { value: "issue", label: "Issue" },
      { value: "send", label: "Send email" },
      { value: "paid", label: "Mark paid" },
      { value: "pdf", label: "Download PDF" },
      { value: "back", label: "Back" },
    ],
  });
  if (p.isCancel(choice) || choice === "back") return;
  if (choice === "list") {
    await cmdInvoiceList(ctx);
    return;
  }
  if (choice === "unpaid") {
    await cmdInvoiceList({ ...ctx, flags: { ...ctx.flags, unpaid: true } });
    return;
  }
  if (choice === "new") {
    await cmdInvoiceNew(ctx);
    return;
  }
  const ref = await pickRef("Invoice number or id");
  if (!ref) return;
  if (choice === "show") await cmdInvoiceShow(ctx, ref);
  else if (choice === "issue") await cmdInvoiceIssue(ctx, ref);
  else if (choice === "send") await cmdInvoiceSend(ctx, ref);
  else if (choice === "paid") await cmdInvoicePaid(ctx, ref);
  else if (choice === "pdf") await cmdInvoiceDownload(ctx, ref, "pdf");
}

async function clientsMenu(ctx: Ctx): Promise<void> {
  const choice = await p.select({
    message: "Clients",
    options: [
      { value: "list", label: "List" },
      { value: "add", label: "Add from ARES (IČO)" },
      { value: "back", label: "Back" },
    ],
  });
  if (p.isCancel(choice) || choice === "back") return;
  if (choice === "list") {
    await cmdClients(ctx);
    return;
  }
  const ico = await pickRef("IČO");
  if (ico) await cmdClientAdd(ctx, ico);
}

async function paymentsMenu(ctx: Ctx): Promise<void> {
  const choice = await p.select({
    message: "Payments",
    options: [
      { value: "list", label: "Pending proposals" },
      { value: "confirm", label: "Confirm a proposal" },
      { value: "reject", label: "Reject a proposal" },
      { value: "back", label: "Back" },
    ],
  });
  if (p.isCancel(choice) || choice === "back") return;
  if (choice === "list") {
    await cmdPayments(ctx);
    return;
  }
  const id = await pickRef("Proposal id");
  if (!id) return;
  await cmdPaymentReview(
    ctx,
    id,
    choice === "confirm" ? "payments.confirm" : "payments.reject",
  );
}

/** Interactive home loop. */
export async function runInteractive(ctx: Ctx): Promise<number> {
  p.intro(brand("Invoicey"));
  await cmdWhoami(ctx);
  await cmdStatus(ctx);
  for (;;) {
    const choice = await p.select({
      message: "What do you want to do?",
      options: [
        { value: "invoices", label: "Invoices" },
        { value: "new", label: "New invoice" },
        { value: "clients", label: "Clients" },
        { value: "issuers", label: "Issuers" },
        { value: "payments", label: "Payments" },
        { value: "ares", label: "ARES lookup" },
        { value: "status", label: "Status" },
        { value: "quit", label: "Quit" },
      ],
    });
    if (p.isCancel(choice) || choice === "quit") {
      p.outro(muted("Later."));
      return 0;
    }
    if (choice === "invoices") await invoicesMenu(ctx);
    else if (choice === "new") await cmdInvoiceNew(ctx);
    else if (choice === "clients") await clientsMenu(ctx);
    else if (choice === "issuers") await cmdIssuers(ctx);
    else if (choice === "payments") await paymentsMenu(ctx);
    else if (choice === "status") await cmdStatus(ctx);
    else if (choice === "ares") {
      const q = await pickRef("IČO or company name");
      if (q) await cmdAres(ctx, q);
    }
  }
}
