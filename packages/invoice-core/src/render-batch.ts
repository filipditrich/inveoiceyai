import { z } from "zod";

import { invoiceArtifactFileNamesFromInvoice } from "./artifact-filenames";
import { InvoiceSchema, type Invoice } from "./schema";

export const INVOICE_RENDER_BATCH_LIMIT = 25;

const JsonObjectSchema = z.record(z.string(), z.unknown());
const JsonContainerSchema = z.union([z.array(z.unknown()), JsonObjectSchema]);
const InvoiceListEnvelopeSchema = z.object({ invoices: z.array(z.unknown()) });

export type InvoiceRenderIssue = {
  index: number;
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

export type InvoiceRenderRequestResult =
  | { ok: true; invoices: Invoice[] }
  | { ok: false; error: "empty" | "invalid_shape" }
  | { ok: false; error: "too_many"; limit: number; count: number }
  | { ok: false; error: "validation_failed"; issues: InvoiceRenderIssue[] };

function extractInvoiceList(body: unknown): unknown[] | null {
  const container = JsonContainerSchema.safeParse(body);
  if (!container.success) {
    return null;
  }
  if (Array.isArray(container.data)) {
    return container.data;
  }
  if (!Object.hasOwn(container.data, "invoices")) {
    return [container.data];
  }
  const envelope = InvoiceListEnvelopeSchema.safeParse(container.data);
  return envelope.success ? envelope.data.invoices : null;
}

function validateInvoiceList(
  raw: unknown[],
  limit: number,
): InvoiceRenderRequestResult {
  if (raw.length === 0) {
    return { ok: false, error: "empty" };
  }
  if (raw.length > limit) {
    return { ok: false, error: "too_many", limit, count: raw.length };
  }

  const invoices: Invoice[] = [];
  const issues: InvoiceRenderIssue[] = [];
  for (const [index, candidate] of raw.entries()) {
    const parsed = InvoiceSchema.safeParse(candidate);
    if (parsed.success) {
      invoices.push(parsed.data);
      continue;
    }
    const flat = parsed.error.flatten();
    issues.push({
      index,
      formErrors: flat.formErrors,
      fieldErrors: flat.fieldErrors,
    });
  }
  if (issues.length > 0) {
    return { ok: false, error: "validation_failed", issues };
  }
  return { ok: true, invoices };
}

/**
 * Accept `{ invoices }`, a bare array, or one `InvoiceSchema` object.
 * Does not persist, number, or match parties — validation only.
 */
export function parseInvoiceRenderRequest(
  body: unknown,
  options?: { limit?: number },
): InvoiceRenderRequestResult {
  const raw = extractInvoiceList(body);
  if (raw === null) {
    return { ok: false, error: "invalid_shape" };
  }
  return validateInvoiceList(raw, options?.limit ?? INVOICE_RENDER_BATCH_LIMIT);
}

/** Localized PDF names; colliding numbers get `_2`, `_3`, … */
export function uniquePdfFileNames(invoices: readonly Invoice[]): string[] {
  const used = new Set<string>();
  return invoices.map((invoice) => {
    const base = invoiceArtifactFileNamesFromInvoice(invoice).pdf;
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = base.replace(/\.pdf$/i, `_${suffix}.pdf`);
      suffix += 1;
    }
    used.add(name);
    return name;
  });
}
