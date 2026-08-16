"use server";

import {
  bankAccounts,
  bankConnections,
  incomingInvoices,
  paymentAuditEvents,
  paymentRunLines,
  paymentRuns,
  supplierBankAccounts,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  classifyFioRail,
  decimalToMinor,
  splitFioImportBatches,
  submitFioImport,
  type FioOrderLine,
} from "@invoicey/payment-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { decryptBankToken } from "@/lib/payments/token-crypto";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";
import { payableEligibility } from "@/lib/incoming-invoices/eligibility";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createPaymentRunAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const issuerId = optionalTrim(formData.get("issuerId"));
  const bankAccountId = optionalTrim(formData.get("bankAccountId"));
  const currency = optionalTrim(formData.get("currency")) ?? "CZK";
  const executionDate =
    optionalTrim(formData.get("executionDate")) ??
    new Date().toISOString().slice(0, 10);
  const ids = formData
    .getAll("ids")
    .filter((id): id is string => typeof id === "string");
  if (!issuerId || !bankAccountId) {
    redirect("/incoming-invoices?invalid=required_fields");
  }
  const now = new Date();
  const week = `${now.getUTCFullYear()}-W${String(getIsoWeek(now)).padStart(2, "0")}`;
  const [run] = await db
    .insert(paymentRuns)
    .values({
      workspaceId,
      issuerId,
      bankAccountId,
      name: `Platby ${week}`,
      executionDate,
      currency,
      createdByUserId: userId,
    })
    .returning({ id: paymentRuns.id });
  if (!run) {
    redirect("/incoming-invoices?invalid=run_create_failed");
  }
  if (ids.length > 0) {
    await addInvoicesToRun(workspaceId, run.id, ids, currency);
  }
  revalidatePath("/incoming-invoices/runs");
  redirect(`/incoming-invoices/runs/${run.id}?toast=payment_run_created`);
}

async function addInvoicesToRun(
  workspaceId: string,
  runId: string,
  invoiceIds: string[],
  runCurrency: string,
) {
  const invoices = await db
    .select()
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.workspaceId, workspaceId),
        inArray(incomingInvoices.id, invoiceIds),
      ),
    );
  for (const invoice of invoices) {
    const [account] = invoice.supplierBankAccountId
      ? await db
          .select()
          .from(supplierBankAccounts)
          .where(eq(supplierBankAccounts.id, invoice.supplierBankAccountId))
          .limit(1)
      : [];
    const outstanding = String(
      Math.max(0, Number(invoice.total ?? 0) - Number(invoice.paidAmount ?? 0)),
    );
    const blockers = payableEligibility({
      status: invoice.status,
      holdUntil: invoice.holdUntil,
      paymentState: invoice.paymentState,
      outstanding,
      currency: invoice.currency,
      runCurrency,
      paymentMethod: invoice.paymentMethod,
      beneficiaryConfirmed: Boolean(account?.confirmedAt),
      hasBeneficiary: Boolean(
        invoice.beneficiaryIban ||
        (invoice.beneficiaryAccountNumber && invoice.beneficiaryBankCode),
      ),
      iban: invoice.beneficiaryIban,
      accountNumber: invoice.beneficiaryAccountNumber,
      bankCode: invoice.beneficiaryBankCode,
      activePaymentRunId: invoice.activePaymentRunId,
      docType: invoice.docType,
    });
    if (blockers.length > 0) {
      continue;
    }
    const rail = classifyFioRail({
      iban: invoice.beneficiaryIban,
      accountNumber: invoice.beneficiaryAccountNumber,
      bankCode: invoice.beneficiaryBankCode,
    });
    if (rail === "foreign") continue;
    const [supplier] = invoice.supplierId
      ? await db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId))
          .limit(1)
      : [];
    await db.insert(paymentRunLines).values({
      workspaceId,
      paymentRunId: runId,
      incomingInvoiceId: invoice.id,
      amount: outstanding,
      currency: invoice.currency,
      beneficiaryName: supplier?.name ?? invoice.supplierNameRaw,
      beneficiaryIban: invoice.beneficiaryIban,
      beneficiaryAccountNumber: invoice.beneficiaryAccountNumber,
      beneficiaryBankCode: invoice.beneficiaryBankCode,
      beneficiaryBic: invoice.beneficiaryBic,
      variableSymbol: invoice.variableSymbol,
      constantSymbol: invoice.constantSymbol,
      specificSymbol: invoice.specificSymbol,
      messageForRecipient: invoice.messageForRecipient,
      comment: `inv/${invoice.id.slice(0, 8)}`,
      rail,
    });
    await db
      .update(incomingInvoices)
      .set({ activePaymentRunId: runId, updatedAt: new Date() })
      .where(eq(incomingInvoices.id, invoice.id));
  }
  await refreshRunTotals(runId);
}

async function refreshRunTotals(runId: string) {
  const [totals] = await db
    .select({
      total: sql<string>`coalesce(sum(${paymentRunLines.amount}) FILTER (WHERE ${paymentRunLines.status} = 'included'), 0)::text`,
      count: sql<number>`coalesce(count(*) FILTER (WHERE ${paymentRunLines.status} = 'included'), 0)`,
    })
    .from(paymentRunLines)
    .where(eq(paymentRunLines.paymentRunId, runId));
  await db
    .update(paymentRuns)
    .set({
      totalAmount: totals?.total ?? "0",
      lineCount: Number(totals?.count ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(paymentRuns.id, runId));
}

export async function dropPaymentRunLineAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const lineId = optionalTrim(formData.get("lineId"));
  const runId = optionalTrim(formData.get("runId"));
  const reason = optionalTrim(formData.get("reason")) ?? "dropped";
  if (!lineId || !runId) {
    redirect("/incoming-invoices/runs?invalid=missing_id");
  }
  const [line] = await db
    .select()
    .from(paymentRunLines)
    .where(
      and(
        eq(paymentRunLines.id, lineId),
        eq(paymentRunLines.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!line) {
    redirect(`/incoming-invoices/runs/${runId}?invalid=not_found`);
  }
  await db
    .update(paymentRunLines)
    .set({ status: "dropped", dropReason: reason })
    .where(eq(paymentRunLines.id, lineId));
  await db
    .update(incomingInvoices)
    .set({ activePaymentRunId: null, updatedAt: new Date() })
    .where(eq(incomingInvoices.id, line.incomingInvoiceId));
  await refreshRunTotals(runId);
  revalidatePath(`/incoming-invoices/runs/${runId}`);
  redirect(`/incoming-invoices/runs/${runId}?toast=payment_run_line_dropped`);
}

export async function confirmPaymentRunAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const runId = optionalTrim(formData.get("runId"));
  if (!runId) {
    redirect("/incoming-invoices/runs?invalid=missing_id");
  }
  const [run] = await db
    .select()
    .from(paymentRuns)
    .where(
      and(eq(paymentRuns.id, runId), eq(paymentRuns.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!run || run.status !== "draft") {
    redirect(`/incoming-invoices/runs/${runId}?invalid=not_draft`);
  }
  const lines = await db
    .select()
    .from(paymentRunLines)
    .where(
      and(
        eq(paymentRunLines.paymentRunId, runId),
        eq(paymentRunLines.status, "included"),
      ),
    );
  let sequence = 1;
  for (const line of lines) {
    const [invoice] = await db
      .select()
      .from(incomingInvoices)
      .where(eq(incomingInvoices.id, line.incomingInvoiceId))
      .limit(1);
    const [supplier] = invoice?.supplierId
      ? await db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, invoice.supplierId))
          .limit(1)
      : [];
    await db
      .update(paymentRunLines)
      .set({
        beneficiaryName:
          supplier?.name ?? invoice?.supplierNameRaw ?? line.beneficiaryName,
        beneficiaryIban: invoice?.beneficiaryIban ?? line.beneficiaryIban,
        beneficiaryAccountNumber:
          invoice?.beneficiaryAccountNumber ?? line.beneficiaryAccountNumber,
        beneficiaryBankCode:
          invoice?.beneficiaryBankCode ?? line.beneficiaryBankCode,
        beneficiaryBic: invoice?.beneficiaryBic ?? line.beneficiaryBic,
        sequence,
      })
      .where(eq(paymentRunLines.id, line.id));
    sequence += 1;
  }
  await refreshRunTotals(runId);
  await db
    .update(paymentRuns)
    .set({ status: "ready", updatedAt: new Date() })
    .where(eq(paymentRuns.id, runId));
  revalidatePath(`/incoming-invoices/runs/${runId}`);
  redirect(`/incoming-invoices/runs/${runId}?toast=payment_run_ready`);
}

export async function submitPaymentRunAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const runId = optionalTrim(formData.get("runId"));
  if (!runId) {
    redirect("/incoming-invoices/runs?invalid=missing_id");
  }
  const [claimed] = await db
    .update(paymentRuns)
    .set({
      status: "submitting",
      submitAttemptCount: sql`${paymentRuns.submitAttemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentRuns.id, runId),
        eq(paymentRuns.workspaceId, workspaceId),
        inArray(paymentRuns.status, ["ready", "failed"]),
      ),
    )
    .returning();
  if (!claimed) {
    redirect(`/incoming-invoices/runs/${runId}?invalid=not_ready`);
  }

  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.id, claimed.bankAccountId),
        eq(bankAccounts.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const [connection] = account
    ? await db
        .select()
        .from(bankConnections)
        .where(eq(bankConnections.id, account.connectionId))
        .limit(1)
    : [];
  if (
    !account ||
    !connection?.paymentSecretCiphertext ||
    connection.paymentKeyVersion == null
  ) {
    await failRun(runId, "payment_token_missing", "payment_token_missing");
    redirect(`/incoming-invoices/runs/${runId}?invalid=payment_token_missing`);
  }
  if (
    connection.paymentTokenExpiresAt &&
    connection.paymentTokenExpiresAt.getTime() <= Date.now()
  ) {
    await failRun(runId, "payment_token_expired", "payment_token_expired");
    redirect(`/incoming-invoices/runs/${runId}?invalid=payment_token_expired`);
  }
  if (
    connection.paymentLastRequestAt &&
    Date.now() - connection.paymentLastRequestAt.getTime() < 30_000
  ) {
    await failRun(runId, "throttled", "fio_throttled_locally");
    redirect(`/incoming-invoices/runs/${runId}?invalid=fio_throttled_locally`);
  }

  const lines = await db
    .select()
    .from(paymentRunLines)
    .where(
      and(
        eq(paymentRunLines.paymentRunId, runId),
        eq(paymentRunLines.status, "included"),
      ),
    );
  const orderLines: FioOrderLine[] = lines.flatMap((line) => {
    if (line.rail !== "domestic" && line.rail !== "sepa") return [];
    return [
      {
        amount: line.amount,
        currency: line.currency,
        beneficiaryName: line.beneficiaryName ?? "Dodavatel",
        beneficiaryIban: line.beneficiaryIban,
        beneficiaryAccountNumber: line.beneficiaryAccountNumber,
        beneficiaryBankCode: line.beneficiaryBankCode,
        beneficiaryBic: line.beneficiaryBic,
        variableSymbol: line.variableSymbol,
        constantSymbol: line.constantSymbol,
        specificSymbol: line.specificSymbol,
        messageForRecipient: line.messageForRecipient,
        comment: line.comment,
        rail: line.rail,
      },
    ];
  });
  if (orderLines.length === 0) {
    await failRun(runId, "empty", "empty_run");
    redirect(`/incoming-invoices/runs/${runId}?invalid=empty_run`);
  }

  const batches = splitFioImportBatches({
    accountFrom: account.accountNumber,
    currency: claimed.currency,
    executionDate: claimed.executionDate,
    lines: orderLines,
  });
  let token: string;
  try {
    token = decryptBankToken(
      connection.paymentSecretCiphertext,
      connection.paymentKeyVersion,
    );
  } catch {
    await failRun(runId, "decrypt_failed", "payment_token_missing");
    redirect(`/incoming-invoices/runs/${runId}?invalid=payment_token_missing`);
  }

  await db
    .update(bankConnections)
    .set({ paymentLastRequestAt: new Date(), updatedAt: new Date() })
    .where(eq(bankConnections.id, connection.id));

  const expectedDebit = claimed.totalAmount;
  const batchIds: string[] = [];
  let lastMessage: string | undefined;
  for (const batch of batches) {
    const result = await submitFioImport({ token, xml: batch.xml });
    lastMessage = result.message;
    if (!result.ok) {
      await failRun(
        runId,
        result.status,
        result.message ?? result.errorCode ?? "fio_import_failed",
      );
      redirect(
        `/incoming-invoices/runs/${runId}?invalid=${encodeURIComponent(result.message ?? "fio_import_failed")}`,
      );
    }
    if (result.idInstruction) batchIds.push(result.idInstruction);
    if (
      result.sumDebet &&
      decimalToMinor(result.sumDebet) !== decimalToMinor(expectedDebit) &&
      batches.length === 1
    ) {
      await failRun(runId, "sum_mismatch", `sumDebet ${result.sumDebet}`);
      redirect(`/incoming-invoices/runs/${runId}?invalid=sum_mismatch`);
    }
  }

  await db
    .update(paymentRuns)
    .set({
      status: "submitted",
      provider: "fio",
      providerBatchId: batchIds.join(",") || null,
      providerStatus: "ok",
      providerMessage: lastMessage ?? null,
      submittedAt: new Date(),
      submittedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(paymentRuns.id, runId));
  await db
    .update(paymentRunLines)
    .set({ status: "submitted" })
    .where(
      and(
        eq(paymentRunLines.paymentRunId, runId),
        eq(paymentRunLines.status, "included"),
      ),
    );
  await db.insert(paymentAuditEvents).values({
    workspaceId,
    action: "payment_run.submitted",
    actorType: "user",
    actorUserId: userId,
    entityType: "payment_run",
    entityId: runId,
    payloadJson: { batchIds, total: expectedDebit },
  });
  revalidatePath(`/incoming-invoices/runs/${runId}`);
  redirect(`/incoming-invoices/runs/${runId}?toast=payment_run_submitted`);
}

async function failRun(
  runId: string,
  providerStatus: string,
  message: string,
): Promise<void> {
  await db
    .update(paymentRuns)
    .set({
      status: "failed",
      providerStatus,
      providerMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(paymentRuns.id, runId));
}

function getIsoWeek(date: Date): number {
  const tmp = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
