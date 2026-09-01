import * as p from "@clack/prompts";

import { brand, muted, ok } from "./print";
import type { Ctx } from "./types";

type LineDraft = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number;
};

async function cancelled(): Promise<null> {
  p.cancel("Cancelled.");
  return null;
}

async function pickClient(): Promise<{
  clientId?: string;
  ico?: string;
} | null> {
  const typed = await p.text({
    message: "Client IČO (8 digits) or saved client UUID",
    validate: (v) =>
      v.trim().length > 0 ? undefined : "IČO or client id required",
  });
  if (p.isCancel(typed)) return cancelled();
  const value = String(typed).replaceAll(/\s/g, "");
  if (/^\d{8}$/.test(value)) return { ico: value };
  return { clientId: value };
}

async function collectLines(): Promise<LineDraft[] | null> {
  const items: LineDraft[] = [];
  for (;;) {
    const description = await p.text({
      message:
        items.length === 0
          ? "Line description"
          : "Another line (empty to stop)",
    });
    if (p.isCancel(description)) return cancelled();
    if (items.length > 0 && String(description).trim() === "") break;
    if (String(description).trim() === "") {
      p.log.error("Need at least one line");
      continue;
    }
    const qty = await p.text({ message: "Quantity", initialValue: "1" });
    if (p.isCancel(qty)) return cancelled();
    const unit = await p.text({ message: "Unit", initialValue: "ks" });
    if (p.isCancel(unit)) return cancelled();
    const price = await p.text({ message: "Unit price without VAT" });
    if (p.isCancel(price)) return cancelled();
    const vat = await p.text({ message: "VAT %", initialValue: "21" });
    if (p.isCancel(vat)) return cancelled();
    items.push({
      description: String(description).trim(),
      quantity: Number(qty),
      unit: String(unit).trim() || "ks",
      unitPriceWithoutVat: Number(price),
      vatRate: Number(vat),
    });
    const more = await p.confirm({
      message: "Add another line?",
      initialValue: false,
    });
    if (p.isCancel(more) || more === false) break;
  }
  return items;
}

/** Interactive draft → optional issue/send. */
export async function wizardCreate(ctx: Ctx): Promise<number> {
  p.intro(brand("New invoice"));
  const party = await pickClient();
  if (!party) return 1;
  const items = await collectLines();
  if (!items || items.length === 0) return 1;
  const due = await p.text({ message: "Due in days", initialValue: "14" });
  if (p.isCancel(due)) return 1;
  const language = await p.select({
    message: "Document language",
    options: [
      { value: "cs", label: "Czech" },
      { value: "en", label: "English" },
    ],
  });
  if (p.isCancel(language)) return 1;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Number(due));
  const created = ctx.client.requireOk(
    await ctx.client.op({
      op: "invoices.create",
      clientId: party.clientId,
      ico: party.ico,
      draft: {
        items,
        meta: {
          docType: "invoice",
          language,
          dueDate: dueDate.toISOString().slice(0, 10),
        },
      },
    }),
  );
  p.log.success(`Draft ${String(created.number ?? created.invoiceId)} saved`);
  const issue = await p.confirm({ message: "Issue now?" });
  if (p.isCancel(issue) || issue !== true) {
    p.outro(muted("Left as draft."));
    return 0;
  }
  const ref = String(created.invoiceId ?? created.number);
  ctx.client.requireOk(await ctx.client.op({ op: "invoices.issue", ref }));
  const send = await p.confirm({ message: "Email to the client?" });
  if (!p.isCancel(send) && send === true) {
    ctx.client.requireOk(await ctx.client.op({ op: "invoices.send", ref }));
    p.outro(ok("Issued and sent."));
    return 0;
  }
  p.outro(ok("Issued."));
  return 0;
}
