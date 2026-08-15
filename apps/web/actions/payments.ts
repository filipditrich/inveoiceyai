"use server";

import {
  confirmPaymentMatchProposal,
  createManualPaymentAllocation,
  rejectPaymentMatchProposal,
  reversePaymentAllocation,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { sendPaymentReceivedEmailIfEnabled } from "@invoicey/invoice-tools/email";
import { decimalToMinor, isValidFioTokenShape } from "@invoicey/payment-core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";
import {
  createFioConnection,
  deleteFioConnection,
  syncFioConnection,
  testFioToken,
} from "@/lib/payments/fio-service";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function paymentRedirect(params: Record<string, string>): never {
  redirect(`/payments?${new URLSearchParams(params).toString()}`);
}

function settingsRedirect(params: Record<string, string>): never {
  redirect(
    `/settings/bank-connections?${new URLSearchParams(params).toString()}`,
  );
}

function revalidatePayments(invoiceId?: string) {
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

export async function connectFio(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const token = field(formData, "token");
  const issuerId = field(formData, "issuerId");
  if (!issuerId) settingsRedirect({ error: "missing_issuer" });
  if (!token) settingsRedirect({ error: "missing_fio_token" });
  if (token.length !== 64) {
    settingsRedirect({ error: "fio_token_must_have_64_characters" });
  }
  if (!isValidFioTokenShape(token)) {
    settingsRedirect({ error: "fio_token_contains_whitespace" });
  }
  let connectionId: string;
  try {
    const batch = await testFioToken(token);
    connectionId = await createFioConnection({
      workspaceId,
      userId,
      issuerId,
      token,
      batch,
    });
  } catch (error) {
    settingsRedirect({
      error: error instanceof Error ? error.message : "fio_connection_failed",
    });
  }
  revalidatePath("/settings/bank-connections");
  revalidatePath("/payments");
  settingsRedirect({ connected: connectionId });
}

export async function syncFio(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const connectionId = field(formData, "connectionId");
  if (!connectionId) settingsRedirect({ error: "missing_connection" });
  const result = await syncFioConnection({ workspaceId, connectionId });
  revalidatePath("/settings/bank-connections");
  revalidatePath("/payments");
  settingsRedirect(
    result.ok
      ? {
          synced: connectionId,
          imported: String(result.imported),
          proposed: String(result.proposed),
        }
      : { error: result.error ?? "fio_sync_failed" },
  );
}

export async function disconnectFio(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const connectionId = field(formData, "connectionId");
  if (!connectionId) settingsRedirect({ error: "missing_connection" });
  const disconnected = await deleteFioConnection({
    workspaceId,
    connectionId,
    userId,
  });
  revalidatePath("/settings/bank-connections");
  settingsRedirect(
    disconnected ? { disconnected: connectionId } : { error: "not_found" },
  );
}

export async function confirmPaymentProposal(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const proposalId = field(formData, "proposalId");
  const result = await confirmPaymentMatchProposal({
    workspaceId,
    proposalId,
    actorUserId: userId,
  });
  if (!result.ok) paymentRedirect({ error: result.error });
  if (result.becamePaid) {
    try {
      await sendPaymentReceivedEmailIfEnabled({
        db,
        workspaceId,
        invoiceId: result.invoiceId,
      });
    } catch (error) {
      console.error("[confirmPaymentProposal] payment email failed", error);
    }
  }
  revalidatePayments(result.invoiceId);
  paymentRedirect({ confirmed: proposalId });
}

export async function rejectPaymentProposal(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const proposalId = field(formData, "proposalId");
  const rejected = await rejectPaymentMatchProposal({
    workspaceId,
    proposalId,
    actorUserId: userId,
  });
  revalidatePayments();
  paymentRedirect(rejected ? { rejected: proposalId } : { error: "not_found" });
}

export async function addManualPayment(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const invoiceId = field(formData, "invoiceId");
  const amount = field(formData, "amount").replace(",", ".");
  const effectiveDate = field(formData, "effectiveDate");
  try {
    if (decimalToMinor(amount) <= BigInt(0)) throw new Error("invalid_amount");
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(effectiveDate)) {
      throw new Error("invalid_date");
    }
  } catch (error) {
    paymentRedirect({
      error: error instanceof Error ? error.message : "invalid_payment",
    });
  }
  const result = await createManualPaymentAllocation({
    workspaceId,
    invoiceId,
    amount,
    effectiveDate,
    actorUserId: userId,
  });
  if (!result.ok) paymentRedirect({ error: result.error });
  if (result.becamePaid) {
    try {
      await sendPaymentReceivedEmailIfEnabled({ db, workspaceId, invoiceId });
    } catch (error) {
      console.error("[addManualPayment] payment email failed", error);
    }
  }
  revalidatePayments(invoiceId);
  paymentRedirect({ added: result.allocationId });
}

export async function reversePayment(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const allocationId = field(formData, "allocationId");
  const result = await reversePaymentAllocation({
    workspaceId,
    allocationId,
    actorUserId: userId,
    reason: field(formData, "reason") || "Reversed by user",
  });
  if (!result.ok) paymentRedirect({ error: result.error });
  revalidatePayments(result.invoiceId);
  const returnTo = field(formData, "returnTo");
  if (/^\/invoices\/[0-9a-f-]{36}$/u.test(returnTo)) {
    redirect(`${returnTo}?toast=payment_reversed`);
  }
  paymentRedirect({ reversed: allocationId });
}
