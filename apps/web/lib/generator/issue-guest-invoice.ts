import "server-only";
import { env } from "@/env.config.server";
import { sendGuestInvoiceEmail } from "@/lib/email/send-guest-invoice";
import { ensureIssuerNumberingSchemes } from "@/lib/issuer-numbering";
import { and, eq } from "drizzle-orm";

import {
  attachGuestIssueInvoice,
  guestAllowancePeriod,
  issuerBusinesses,
  persistDraftInvoice,
  releaseGuestIssue,
  reserveGuestIssue,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { issueInvoiceById } from "@invoicey/invoice-tools/ops";

import { defaultGuestInvoiceNumber } from "./default-number";
import { GuestTokenSecretMissingError, signGuestToken } from "./tokens";

export type GuestIssueResult =
  | {
      ok: true;
      workspaceId: string;
      invoiceId: string;
      number: string;
      downloadToken: string;
      mailed: boolean;
    }
  | {
      ok: false;
      reason: "allowance_exhausted" | "invoice_invalid" | "issue_failed";
      issues?: unknown;
      period?: string;
    };

function appOrigin(): string {
  return (env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

async function markIssuerDefault(
  workspaceId: string,
  issuerId: string,
): Promise<void> {
  await db
    .update(issuerBusinesses)
    .set({ isDefault: true })
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    );
}

/**
 * Ordinary repository path into an unclaimed guest workspace (ADR 0048 §2).
 * The reservation, not this function, is the monthly allowance.
 */
export async function issueGuestInvoice(input: {
  invoice: Invoice;
  email: string;
  marketingOptIn: boolean;
}): Promise<GuestIssueResult> {
  const issueDate = new Date(`${input.invoice.meta.issueDate}T12:00:00.000Z`);
  const chosenNumber =
    input.invoice.meta.number.trim() ||
    defaultGuestInvoiceNumber(input.invoice.issuer.name, issueDate);
  const invoice: Invoice = {
    ...input.invoice,
    meta: { ...input.invoice.meta, number: chosenNumber },
  };

  const reserved = await reserveGuestIssue(db, {
    email: input.email,
    issuerIco: invoice.issuer.ico,
    marketingOptIn: input.marketingOptIn,
    workspaceName: invoice.issuer.name,
  });
  if (!reserved.ok) {
    return {
      ok: false,
      reason: "allowance_exhausted",
      period: guestAllowancePeriod(new Date()),
    };
  }

  try {
    const persisted = await persistDraftInvoice(db, invoice, {
      workspaceId: reserved.workspaceId,
    });
    await ensureIssuerNumberingSchemes(db, {
      workspaceId: reserved.workspaceId,
      issuerId: persisted.issuerId,
    });
    await markIssuerDefault(reserved.workspaceId, persisted.issuerId);

    const issued = await issueInvoiceById({
      id: persisted.invoiceId,
      workspaceId: reserved.workspaceId,
      number: chosenNumber,
    });
    if (!issued.ok) {
      throw new Error(issued.error);
    }

    await attachGuestIssueInvoice(db, {
      reservationId: reserved.reservationId,
      invoiceId: persisted.invoiceId,
    });

    const tokenInput = {
      workspaceId: reserved.workspaceId,
      invoiceId: persisted.invoiceId,
      email: input.email,
    };
    const downloadToken = signGuestToken({
      ...tokenInput,
      purpose: "download",
    });
    const claimToken = signGuestToken({ ...tokenInput, purpose: "claim" });
    const origin = appOrigin();
    const claimUrl = `${origin}/claim/${claimToken}`;
    const downloadUrl = `${origin}/api/generator/invoice/${downloadToken}`;

    let mailed = false;
    try {
      const sent = await sendGuestInvoiceEmail({
        workspaceId: reserved.workspaceId,
        invoiceId: persisted.invoiceId,
        invoice: issued.invoice,
        to: input.email,
        claimUrl,
        downloadUrl,
      });
      mailed = sent.ok;
    } catch (error) {
      console.error("[invoicey] guest invoice mail failed", error);
    }

    return {
      ok: true,
      workspaceId: reserved.workspaceId,
      invoiceId: persisted.invoiceId,
      number: issued.invoice.meta.number,
      downloadToken,
      mailed,
    };
  } catch (error) {
    await releaseGuestIssue(db, {
      reservationId: reserved.reservationId,
      workspaceId: reserved.workspaceId,
    });
    if (error instanceof GuestTokenSecretMissingError) throw error;
    console.error("[invoicey] guest issue failed", error);
    return { ok: false, reason: "issue_failed" };
  }
}
