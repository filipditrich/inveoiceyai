"use server";

import {
  addDaysIso,
  buildInvoicePayload,
  todayIsoDate,
  type BuilderLineInput,
} from "@/lib/build-invoice";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { loadLastInvoiceSuggestions } from "@/lib/load-last-invoice-suggestions";
import type { LastInvoiceSuggestions } from "@/lib/last-invoice-suggestions";
import { invoicePaymentIdentifiers } from "@/lib/payments/invoice-payment-identifiers";
import {
  ClientSnapshotSchema,
  InvoiceSchema,
  IssuerSnapshotSchema,
  nextInvoiceNumber,
  type Invoice,
} from "@invoicey/invoice-core";
import {
  AppearanceOverrideSchema,
  LookRefSchema,
  type AppearanceOverride,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import {
  bulkCancelInvoices,
  bulkDeleteDraftInvoices,
  bulkIssueInvoices,
  bulkMarkInvoicesPaid,
  bulkUnmarkInvoicesPaid,
  cancelInvoiceById,
  issueInvoiceById,
  markInvoicePaidById,
  unmarkInvoicePaidById,
  applyLookToDraftWrite,
  applyLookToNewDraft,
  loadWorkspaceLookContext,
  lookColumns,
  snapshotLookAtIssue,
} from "@invoicey/invoice-tools/ops";
import { tryPersistInvoiceArtifacts } from "@invoicey/invoice-tools/artifacts";
import {
  clients,
  invoiceItems,
  invoices,
  issuerBusinesses,
  issuerNumberingSchemes,
} from "@invoicey/db";
import {
  withDbTransaction,
  type DbTransaction,
} from "@invoicey/db/transaction";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendInvoiceEmailById } from "@invoicey/invoice-tools/email";
import { isInvoiceDraftRecoveryAttempt } from "@/lib/invoice-draft-recovery";
import { notifyTokenRewardByEmail } from "@/lib/ai/token-reward-email";

function optionalTrim(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

function parseLines(formData: FormData): BuilderLineInput[] {
  const raw = optionalTrim(formData.get("itemsJson"));
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const lines: BuilderLineInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as Record<string, unknown>;
    const description =
      typeof r.description === "string" ? r.description.trim() : "";
    const quantity = Number(r.quantity);
    const unit = typeof r.unit === "string" ? r.unit.trim() : "ks";
    const unitPriceWithoutVat = Number(r.unitPriceWithoutVat);
    const vatRate = Number(r.vatRate);
    if (!description || !Number.isFinite(quantity) || quantity === 0) {
      continue;
    }
    if (!Number.isFinite(unitPriceWithoutVat) || unitPriceWithoutVat < 0) {
      continue;
    }
    if (!Number.isFinite(vatRate)) {
      continue;
    }
    lines.push({
      description,
      quantity,
      unit: unit || "ks",
      unitPriceWithoutVat,
      vatRate,
    });
  }
  return lines;
}

async function loadIssuerClient(
  workspaceId: string,
  issuerId: string,
  clientId: string,
) {
  const issuerRows = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const clientRows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId)))
    .limit(1);
  const issuerSnap = issuerRows[0]
    ? IssuerSnapshotSchema.safeParse(issuerRows[0].snapshot)
    : null;
  const clientSnap = clientRows[0]
    ? ClientSnapshotSchema.safeParse(clientRows[0].snapshot)
    : null;
  if (!issuerSnap?.success || !clientSnap?.success) {
    return null;
  }
  return { issuer: issuerSnap.data, client: clientSnap.data };
}

type DocType = Invoice["meta"]["docType"];
type VatMode = Invoice["vat"]["mode"];
type SuppliesAbroad = Invoice["vat"]["suppliesAbroad"];

function formToBuilderFields(formData: FormData): {
  issuerId: string | undefined;
  clientId: string | undefined;
  docType: DocType;
  issueDate: string;
  dueDate: string;
  duzp: string;
  currency: Invoice["meta"]["currency"];
  language: Invoice["meta"]["language"];
  vatMode: VatMode;
  pricesIncludeVat: boolean;
  suppliesAbroad: SuppliesAbroad;
  notes: string | undefined;
  legalNote: string | undefined;
  localReverseChargeCode: string | undefined;
  correctedInvoiceNumber: string | undefined;
  items: BuilderLineInput[];
  look: LookRef | undefined;
  appearance: AppearanceOverride | undefined;
} {
  const issuerId = optionalTrim(formData.get("issuerId"));
  const clientId = optionalTrim(formData.get("clientId"));
  const docTypeRaw = optionalTrim(formData.get("docType")) ?? "invoice";
  const docType: DocType =
    docTypeRaw === "proforma" ||
    docTypeRaw === "advance" ||
    docTypeRaw === "credit_note"
      ? docTypeRaw
      : "invoice";
  const issueDate = optionalTrim(formData.get("issueDate")) ?? todayIsoDate();
  const dueDate =
    optionalTrim(formData.get("dueDate")) ?? addDaysIso(issueDate, 14);
  const duzp = optionalTrim(formData.get("duzp")) ?? issueDate;
  const currencyRaw = optionalTrim(formData.get("currency")) ?? "CZK";
  const currency: Invoice["meta"]["currency"] =
    currencyRaw === "EUR" || currencyRaw === "USD" ? currencyRaw : "CZK";
  const languageRaw = optionalTrim(formData.get("language")) ?? "cs";
  const language: Invoice["meta"]["language"] =
    languageRaw === "en" ? "en" : "cs";
  const vatModeRaw = optionalTrim(formData.get("vatMode")) ?? "regular";
  const vatMode: VatMode =
    vatModeRaw === "reverse_charge" || vatModeRaw === "oss"
      ? vatModeRaw
      : "regular";
  const pricesIncludeVat =
    optionalTrim(formData.get("pricesIncludeVat")) === "true";
  const suppliesRaw = optionalTrim(formData.get("suppliesAbroad")) ?? "none";
  const suppliesAbroad: SuppliesAbroad =
    suppliesRaw === "eu" || suppliesRaw === "non_eu" ? suppliesRaw : "none";
  const notes = optionalTrim(formData.get("notes"));
  const legalNote = optionalTrim(formData.get("legalNote"));
  const localReverseChargeCode = optionalTrim(
    formData.get("localReverseChargeCode"),
  );
  const correctedInvoiceNumber = optionalTrim(
    formData.get("correctedInvoiceNumber"),
  );
  const items = parseLines(formData);
  const lookParsed = LookRefSchema.safeParse({
    id: optionalTrim(formData.get("lookId")),
    version: optionalTrim(formData.get("lookVersion")),
  });
  const look = lookParsed.success ? lookParsed.data : undefined;
  let appearance: AppearanceOverride | undefined;
  const appearanceRaw = optionalTrim(formData.get("appearanceJson"));
  if (appearanceRaw) {
    try {
      const parsedAppearance = AppearanceOverrideSchema.safeParse(
        JSON.parse(appearanceRaw) as unknown,
      );
      if (parsedAppearance.success) {
        appearance = parsedAppearance.data;
      }
    } catch {
      appearance = undefined;
    }
  }
  return {
    issuerId,
    clientId,
    docType,
    issueDate,
    dueDate,
    duzp,
    currency,
    language,
    vatMode,
    pricesIncludeVat,
    suppliesAbroad,
    notes,
    legalNote,
    localReverseChargeCode,
    correctedInvoiceNumber,
    items,
    look,
    appearance,
  };
}

function rowValuesFromInvoice(
  invoice: Invoice,
  opts: {
    id: string;
    workspaceId: string;
    issuerId: string;
    clientId: string;
    issuedAt: Date | null;
    paidAt: Date | null;
    cancelledAt: Date | null;
  },
) {
  return {
    id: opts.id,
    workspaceId: opts.workspaceId,
    issuerId: opts.issuerId,
    clientId: opts.clientId,
    docType: invoice.meta.docType,
    number: invoice.meta.number === "DRAFT" ? null : invoice.meta.number,
    issueDate: invoice.meta.issueDate,
    dueDate: invoice.meta.dueDate,
    duzp: invoice.meta.duzp,
    issuedAt: opts.issuedAt,
    paidAt: opts.paidAt,
    cancelledAt: opts.cancelledAt,
    currency: invoice.meta.currency,
    ...invoicePaymentIdentifiers(invoice.payment),
    total: String(invoice.totals.total),
    subtotal: String(invoice.totals.subtotal),
    vatTotal: String(invoice.totals.vatTotal),
    clientName: invoice.client.name,
    notes: invoice.notes ?? null,
    issuerSnapshot: invoice.issuer as unknown as Record<string, unknown>,
    clientSnapshot: invoice.client as unknown as Record<string, unknown>,
    payloadJson: invoice as unknown as Record<string, unknown>,
    ...lookColumns(invoice),
    updatedAt: new Date(),
  };
}

async function replaceItems(
  tx: DbTransaction,
  invoiceId: string,
  invoice: Invoice,
) {
  await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  if (invoice.items.length === 0) {
    return;
  }
  await tx.insert(invoiceItems).values(
    invoice.items.map((line) => ({
      id: crypto.randomUUID(),
      invoiceId,
      position: line.position,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPriceWithoutVat: String(line.unitPriceWithoutVat),
      vatRate: String(line.vatRate),
      lineSubtotal: String(line.lineSubtotal),
      lineVat: String(line.lineVat),
      lineTotal: String(line.lineTotal),
    })),
  );
}

/** Persist draft without consuming a number. */
export async function saveInvoiceDraft(formData: FormData): Promise<void> {
  await assertCan("invoices:create");
  const { workspaceId } = await requireWorkspace();
  const existingId = optionalTrim(formData.get("id"));
  const recoveryAttempt = existingId
    ? undefined
    : optionalTrim(formData.get("recoveryAttempt"));
  const errBase =
    existingId !== undefined ? `/invoices/${existingId}/edit` : "/invoices/new";
  const fields = formToBuilderFields(formData);
  if (!fields.issuerId || !fields.clientId || fields.items.length === 0) {
    redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
  }

  const parties = await loadIssuerClient(
    workspaceId,
    fields.issuerId,
    fields.clientId,
  );
  if (!parties) {
    redirect(`${errBase}?invalid=${encodeURIComponent("missing_parties")}`);
  }

  let invoice: Invoice;
  try {
    invoice = buildInvoicePayload({
      docType: fields.docType,
      number: "DRAFT",
      issueDate: fields.issueDate,
      dueDate: fields.dueDate,
      duzp: fields.duzp,
      currency: fields.currency,
      language: fields.language,
      issuer: parties.issuer,
      client: parties.client,
      vatMode: fields.vatMode,
      pricesIncludeVat: fields.pricesIncludeVat,
      suppliesAbroad: fields.suppliesAbroad,
      legalNote: fields.legalNote,
      localReverseChargeCode: fields.localReverseChargeCode,
      correctedInvoiceNumber: fields.correctedInvoiceNumber,
      items: fields.items,
      notes: fields.notes,
      look: fields.look,
      appearance: fields.appearance,
    });
  } catch {
    redirect(`${errBase}?invalid=${encodeURIComponent("validation")}`);
  }

  const id = existingId ?? crypto.randomUUID();

  try {
    await withDbTransaction(async (tx) => {
      let existingLook: LookRef | undefined;
      if (existingId) {
        const existing = await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, existingId),
              eq(invoices.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (!existing[0]) {
          throw new Error("missing_row");
        }
        if (existing[0].issuedAt) {
          throw new Error("not_draft");
        }
        const previous = InvoiceSchema.safeParse(existing[0].payloadJson);
        existingLook = previous.success ? previous.data.look : undefined;
        const lookContext = await loadWorkspaceLookContext(tx, workspaceId);
        const withLook = applyLookToDraftWrite(
          invoice,
          lookContext,
          existingLook,
        );
        if (!withLook.ok) {
          throw new Error(withLook.error);
        }
        invoice = withLook.invoice;
        await tx
          .update(invoices)
          .set(
            rowValuesFromInvoice(invoice, {
              id,
              workspaceId,
              issuerId: fields.issuerId!,
              clientId: fields.clientId!,
              issuedAt: null,
              paidAt: existing[0].paidAt,
              cancelledAt: existing[0].cancelledAt,
            }),
          )
          .where(eq(invoices.id, id));
      } else {
        const lookContext = await loadWorkspaceLookContext(tx, workspaceId);
        const withLook = applyLookToDraftWrite(invoice, lookContext);
        if (!withLook.ok) {
          throw new Error(withLook.error);
        }
        invoice = withLook.invoice;
        await tx.insert(invoices).values({
          ...rowValuesFromInvoice(invoice, {
            id,
            workspaceId,
            issuerId: fields.issuerId!,
            clientId: fields.clientId!,
            issuedAt: null,
            paidAt: null,
            cancelledAt: null,
          }),
          createdAt: new Date(),
        });
      }
      await replaceItems(tx, id, invoice);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "save_failed";
    if (msg === "not_draft") {
      redirect(`/invoices/${id}?invalid=${encodeURIComponent("not_draft")}`);
    }
    redirect(`${errBase}?invalid=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  const successQuery = new URLSearchParams({ toast: "invoice_saved" });
  if (isInvoiceDraftRecoveryAttempt(recoveryAttempt)) {
    successQuery.set("recoveryAttempt", recoveryAttempt);
  }
  redirect(`/invoices/${id}/edit?${successQuery}`);
}

/** Issue: lock numbering, assign number, freeze snapshots. */
export async function issueInvoice(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("invoices:issue");
  const existingId = optionalTrim(formData.get("id"));
  const recoveryAttempt = existingId
    ? undefined
    : optionalTrim(formData.get("recoveryAttempt"));
  const errBase =
    existingId !== undefined ? `/invoices/${existingId}/edit` : "/invoices/new";
  const fields = formToBuilderFields(formData);
  if (!fields.issuerId || !fields.clientId || fields.items.length === 0) {
    redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
  }

  if (existingId) {
    const existing = await db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.id, existingId), eq(invoices.workspaceId, workspaceId)),
      )
      .limit(1);
    if (existing[0]?.issuedAt) {
      redirect(
        `/invoices/${existingId}?invalid=${encodeURIComponent("already_issued")}`,
      );
    }
  }

  const invoiceId = existingId ?? crypto.randomUUID();

  try {
    const issuedInvoice = await withDbTransaction(async (tx) => {
      const issuerRows = await tx
        .select()
        .from(issuerBusinesses)
        .where(
          and(
            eq(issuerBusinesses.id, fields.issuerId!),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      const clientRows = await tx
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, fields.clientId!),
            eq(clients.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      const issuerSnap = issuerRows[0]
        ? IssuerSnapshotSchema.safeParse(issuerRows[0].snapshot)
        : null;
      const clientSnap = clientRows[0]
        ? ClientSnapshotSchema.safeParse(clientRows[0].snapshot)
        : null;
      if (!issuerSnap?.success || !clientSnap?.success) {
        throw new Error("missing_parties");
      }

      const schemeRows = await tx
        .select()
        .from(issuerNumberingSchemes)
        .where(
          and(
            eq(issuerNumberingSchemes.issuerId, fields.issuerId!),
            eq(issuerNumberingSchemes.docType, fields.docType),
          ),
        )
        .for("update")
        .limit(1);

      const scheme = schemeRows[0];
      if (!scheme) {
        throw new Error("missing_scheme");
      }

      const issueDate = new Date(`${fields.issueDate}T12:00:00.000Z`);
      const number = nextInvoiceNumber(
        {
          template: scheme.template,
          counter: scheme.counter,
          counterYear: scheme.counterYear ?? undefined,
          resetPeriod: scheme.resetPeriod === "never" ? "never" : "yearly",
          padding: scheme.padding,
          docType: fields.docType,
          issuerName: issuerSnap.data.name,
        },
        issueDate,
      );

      const year = issueDate.getFullYear();
      let nextCounter = scheme.counter + 1;
      let nextYear = scheme.counterYear;
      if (scheme.resetPeriod === "yearly") {
        if (scheme.counterYear !== null && scheme.counterYear !== year) {
          nextCounter = 1;
        }
        nextYear = year;
      }

      const invoice = buildInvoicePayload({
        docType: fields.docType,
        number,
        issueDate: fields.issueDate,
        dueDate: fields.dueDate,
        duzp: fields.duzp,
        currency: fields.currency,
        language: fields.language,
        issuer: issuerSnap.data,
        client: clientSnap.data,
        vatMode: fields.vatMode,
        pricesIncludeVat: fields.pricesIncludeVat,
        suppliesAbroad: fields.suppliesAbroad,
        legalNote: fields.legalNote,
        localReverseChargeCode: fields.localReverseChargeCode,
        correctedInvoiceNumber: fields.correctedInvoiceNumber,
        items: fields.items,
        notes: fields.notes,
        look: fields.look,
        appearance: fields.appearance,
      });

      const parsed = InvoiceSchema.safeParse(invoice);
      if (!parsed.success) {
        throw new Error("validation");
      }

      const lookContext = await loadWorkspaceLookContext(tx, workspaceId);
      const snapped = snapshotLookAtIssue(parsed.data, lookContext.apply);
      if (!snapped.ok) {
        throw new Error(snapped.error);
      }

      const issuedAt = new Date();
      const values = rowValuesFromInvoice(snapped.invoice, {
        id: invoiceId,
        workspaceId,
        issuerId: fields.issuerId!,
        clientId: fields.clientId!,
        issuedAt,
        paidAt: null,
        cancelledAt: null,
      });

      if (existingId) {
        await tx.update(invoices).set(values).where(eq(invoices.id, invoiceId));
      } else {
        await tx.insert(invoices).values({ ...values, createdAt: new Date() });
      }

      await tx
        .delete(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));
      await tx.insert(invoiceItems).values(
        snapped.invoice.items.map((line) => ({
          id: crypto.randomUUID(),
          invoiceId,
          position: line.position,
          description: line.description,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPriceWithoutVat: String(line.unitPriceWithoutVat),
          vatRate: String(line.vatRate),
          lineSubtotal: String(line.lineSubtotal),
          lineVat: String(line.lineVat),
          lineTotal: String(line.lineTotal),
        })),
      );

      await tx
        .update(issuerNumberingSchemes)
        .set({
          counter: nextCounter,
          counterYear: nextYear,
          updatedAt: new Date(),
        })
        .where(eq(issuerNumberingSchemes.id, scheme.id));

      return snapped.invoice;
    });
    if (issuedInvoice) {
      await tryPersistInvoiceArtifacts({
        id: invoiceId,
        workspaceId,
        invoice: issuedInvoice,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "issue_failed";
    redirect(`${errBase}?invalid=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  const successQuery = new URLSearchParams({ toast: "invoice_issued" });
  if (isInvoiceDraftRecoveryAttempt(recoveryAttempt)) {
    successQuery.set("recoveryAttempt", recoveryAttempt);
  }
  redirect(`/invoices/${invoiceId}?${successQuery}`);
}

/** Issue a saved draft by id (detail / list / bulk). */
export async function issueSavedInvoice(formData: FormData): Promise<void> {
  await assertCan("invoices:issue");
  const { workspaceId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const result = await issueInvoiceById({ id, workspaceId });
  if (!result.ok) {
    redirect(
      `/invoices/${id}?invalid=${encodeURIComponent(result.error || "cannot_issue")}`,
    );
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${id}`);

  // A plan award that fired on this issue — in practice the first-invoice
  // reward. `grants` is only non-empty when the ledger actually credited, so
  // this cannot celebrate twice (ADR 0037).
  const reward = result.grants.find((grant) => grant.notify);
  if (reward) {
    revalidatePath("/settings/workspace/usage");
    await notifyTokenRewardByEmail({ workspaceId, tokens: reward.tokens });
    redirect(
      `/invoices/${id}?toast=invoice_issued_rewarded&tokens=${reward.tokens}`,
    );
  }

  redirect(`/invoices/${id}?toast=invoice_issued`);
}

export async function bulkIssueInvoice(formData: FormData): Promise<void> {
  await assertCan("invoices:issue");
  const { workspaceId } = await requireWorkspace();
  const ids = collectIds(formData);
  if (ids.length === 0) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_ids")}`);
  }
  bulkRedirect(await bulkIssueInvoices({ ids, workspaceId }));
}

export async function markInvoicePaid(formData: FormData): Promise<void> {
  await assertCan("payments:manage");
  const { workspaceId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const result = await markInvoicePaidById({ id, workspaceId });
  if (!result.ok) {
    redirect(`/invoices?invalid=${encodeURIComponent("cannot_mark_paid")}`);
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}?toast=invoice_paid`);
}

export async function unmarkInvoicePaid(formData: FormData): Promise<void> {
  await assertCan("payments:manage");
  const { workspaceId, userId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const result = await unmarkInvoicePaidById({
    id,
    workspaceId,
    actorUserId: userId,
  });
  if (!result.ok) {
    redirect(`/invoices?invalid=${encodeURIComponent("cannot_unmark_paid")}`);
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}?toast=invoice_unpaid`);
}

function collectIds(formData: FormData): string[] {
  return formData
    .getAll("ids")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function bulkRedirect(result: {
  ok: number;
  skipped: number;
  failed: number;
}): never {
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  const q = new URLSearchParams({
    toast: "bulk_summary",
    ok: String(result.ok),
    skipped: String(result.skipped),
    failed: String(result.failed),
  });
  redirect(`/invoices?${q.toString()}`);
}

export async function bulkMarkInvoicePaid(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("payments:manage");
  const ids = collectIds(formData);
  if (ids.length === 0) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_ids")}`);
  }
  bulkRedirect(await bulkMarkInvoicesPaid({ ids, workspaceId }));
}

export async function bulkUnmarkInvoicePaid(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await assertCan("payments:manage");
  const ids = collectIds(formData);
  if (ids.length === 0) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_ids")}`);
  }
  bulkRedirect(await bulkUnmarkInvoicesPaid({ ids, workspaceId }));
}

export async function bulkCancelInvoice(formData: FormData): Promise<void> {
  await assertCan("invoices:issue");
  const { workspaceId } = await requireWorkspace();
  const ids = collectIds(formData);
  if (ids.length === 0) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_ids")}`);
  }
  bulkRedirect(await bulkCancelInvoices({ ids, workspaceId }));
}

export async function bulkDeleteInvoice(formData: FormData): Promise<void> {
  await assertCan("invoices:delete");
  const { workspaceId } = await requireWorkspace();
  const ids = collectIds(formData);
  if (ids.length === 0) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_ids")}`);
  }
  bulkRedirect(await bulkDeleteDraftInvoices({ ids, workspaceId }));
}

/** Cancel an issued (unpaid) invoice. */
export async function cancelInvoice(formData: FormData): Promise<void> {
  await assertCan("invoices:issue");
  const { workspaceId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const result = await cancelInvoiceById({ id, workspaceId });
  if (!result.ok) {
    redirect(`/invoices/${id}?invalid=${encodeURIComponent("cannot_cancel")}`);
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}?toast=invoice_cancelled`);
}

export async function deleteInvoice(formData: FormData): Promise<void> {
  const id = optionalTrim(formData.get("id"));
  const { workspaceId } = await requireWorkspace();
  await assertCan("invoices:delete");
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_row")}`);
  }
  if (rows[0].issuedAt && !rows[0].cancelledAt) {
    redirect(`/invoices?invalid=${encodeURIComponent("not_draft")}`);
  }
  await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)));
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect("/invoices?toast=invoice_deleted");
}

/** Duplicate issued or draft into a new draft. */
export async function duplicateInvoice(formData: FormData): Promise<void> {
  const id = optionalTrim(formData.get("id"));
  const { workspaceId } = await requireWorkspace();
  await assertCan("invoices:create");
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_row")}`);
  }
  const payload = InvoiceSchema.safeParse(row.payloadJson);
  if (!payload.success) {
    redirect(`/invoices?invalid=${encodeURIComponent("bad_payload")}`);
  }
  const { lookSnapshot: _snapshot, ...rest } = payload.data;
  const lookContext = await loadWorkspaceLookContext(db, workspaceId);
  const draft = applyLookToNewDraft(
    { ...rest, meta: { ...rest.meta, number: "DRAFT" } },
    lookContext,
  );
  const newId = crypto.randomUUID();
  await withDbTransaction(async (tx) => {
    await tx.insert(invoices).values({
      ...rowValuesFromInvoice(draft, {
        id: newId,
        workspaceId,
        issuerId: row.issuerId,
        clientId: row.clientId,
        issuedAt: null,
        paidAt: null,
        cancelledAt: null,
      }),
      createdAt: new Date(),
    });
    await replaceItems(tx, newId, draft);
  });
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(`/invoices/${newId}/edit?toast=invoice_duplicated`);
}

/** Send issued invoice by email. */
export async function sendInvoiceEmail(formData: FormData): Promise<void> {
  const id = optionalTrim(formData.get("id"));
  const { workspaceId, userId } = await requireWorkspace();
  await assertCan("invoices:send");
  if (!id) {
    redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
  }

  const to = optionalTrim(formData.get("to"));
  const ccRaw = optionalTrim(formData.get("cc"));
  const subject = optionalTrim(formData.get("subject"));
  const coverText = optionalTrim(formData.get("coverText"));
  const attachIsdoc =
    formData.get("attachIsdoc") === "on" ||
    formData.get("attachIsdoc") === "true";
  const displayName = optionalTrim(formData.get("displayName"));

  const cc = ccRaw
    ? ccRaw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const result = await sendInvoiceEmailById({
    id,
    workspaceId,
    to,
    cc,
    subject,
    coverText,
    attachIsdoc,
    displayName,
    createdBy: userId,
  });

  if (!result.ok) {
    redirect(`/invoices/${id}?invalid=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}?toast=invoice_emailed`);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | undefined): string | undefined {
  if (!value || !UUID_RE.test(value)) {
    return undefined;
  }
  return value;
}

export async function getLastInvoiceSuggestionsAction(input: {
  issuerId?: string;
  clientId?: string;
  excludeId?: string;
}): Promise<LastInvoiceSuggestions | null> {
  const { workspaceId } = await requireWorkspace();
  return loadLastInvoiceSuggestions(workspaceId, {
    issuerId: optionalUuid(input.issuerId),
    clientId: optionalUuid(input.clientId),
    excludeId: optionalUuid(input.excludeId),
  });
}
