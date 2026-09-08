import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import {
  bankAccounts,
  bankConnections,
  issuerBusinesses,
  loadPaymentRequest,
  loadPaymentRequestByPublicToken,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { buildSpaydPayloadFromFacts } from "@invoicey/invoice-core";
import { IssuerSnapshotSchema } from "@invoicey/invoice-core/schema";

import { resolveCollectionProgress } from "./invoice-collection";

export type PaymentRequestCollection = {
  requestId: string;
  connectionId: string;
  publicToken: string;
  title: string;
  currency: "CZK";
  accountNumber: string;
  iban: string;
  variableSymbol: string;
  requestedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  settled: boolean;
  paymentState: "unpaid" | "partial" | "paid" | "overpaid";
  qrPayload: string;
  issuerName: string;
};

function requestPaymentState(
  status: string,
  requested: string,
  allocated: string,
): "unpaid" | "partial" | "paid" | "overpaid" {
  if (status === "settled") {
    return Number(allocated) > Number(requested) ? "overpaid" : "paid";
  }
  if (Number(allocated) > 0) return "partial";
  return "unpaid";
}

export async function loadPaymentRequestCollection(
  workspaceId: string,
  requestId: string,
): Promise<PaymentRequestCollection | null> {
  const request = await loadPaymentRequest(db, workspaceId, requestId);
  if (!request) return null;

  const [row] = await db
    .select({
      accountNumber: bankAccounts.accountNumber,
      iban: bankAccounts.iban,
      bic: bankAccounts.bic,
      connectionId: bankConnections.id,
      issuerSnapshot: issuerBusinesses.snapshot,
    })
    .from(bankAccounts)
    .innerJoin(
      bankConnections,
      and(
        eq(bankConnections.id, bankAccounts.connectionId),
        eq(bankConnections.workspaceId, workspaceId),
        eq(bankConnections.status, "active"),
        inArray(bankConnections.provider, ["fio", "moneta"]),
      ),
    )
    .innerJoin(
      issuerBusinesses,
      and(
        eq(issuerBusinesses.id, request.issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(bankAccounts.id, request.bankAccountId),
        eq(bankAccounts.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const parsed = IssuerSnapshotSchema.safeParse(row.issuerSnapshot);
  const issuerName = parsed.success ? parsed.data.name : "Invoicey";
  const paymentState = requestPaymentState(
    request.status,
    request.amount,
    request.allocatedAmount,
  );
  const progress = resolveCollectionProgress(
    request.amount,
    request.allocatedAmount,
    paymentState,
  );
  const qrPayload = buildSpaydPayloadFromFacts({
    iban: row.iban,
    bic: row.bic,
    amount: Number(progress.outstandingAmount),
    currency: "CZK",
    beneficiaryName: issuerName,
    beneficiaryMessage: request.message,
    variableSymbol: request.variableSymbol,
  });
  if (!qrPayload) return null;

  return {
    requestId: request.id,
    connectionId: row.connectionId,
    publicToken: request.publicToken,
    title: request.message?.trim() || "",
    currency: "CZK",
    accountNumber: row.accountNumber,
    iban: row.iban,
    variableSymbol: request.variableSymbol,
    requestedAmount: request.amount,
    paidAmount: progress.paidAmount,
    outstandingAmount: progress.outstandingAmount,
    settled: request.status === "settled" || progress.settled,
    paymentState,
    qrPayload,
    issuerName,
  };
}

export async function loadPublicPaymentRequest(token: string): Promise<{
  issuerName: string;
  amount: string;
  currency: "CZK";
  accountNumber: string;
  iban: string;
  variableSymbol: string;
  qrPayload: string;
  title: string;
} | null> {
  const request = await loadPaymentRequestByPublicToken(db, token);
  if (!request || request.status === "cancelled") return null;

  const [row] = await db
    .select({
      accountNumber: bankAccounts.accountNumber,
      iban: bankAccounts.iban,
      bic: bankAccounts.bic,
      issuerSnapshot: issuerBusinesses.snapshot,
    })
    .from(bankAccounts)
    .innerJoin(issuerBusinesses, eq(issuerBusinesses.id, request.issuerId))
    .where(eq(bankAccounts.id, request.bankAccountId))
    .limit(1);
  if (!row) return null;

  const parsed = IssuerSnapshotSchema.safeParse(row.issuerSnapshot);
  const issuerName = parsed.success ? parsed.data.name : "Invoicey";
  const qrPayload = buildSpaydPayloadFromFacts({
    iban: row.iban,
    bic: row.bic,
    amount: Number(request.amount),
    currency: "CZK",
    beneficiaryName: issuerName,
    beneficiaryMessage: request.message,
    variableSymbol: request.variableSymbol,
  });
  if (!qrPayload) return null;

  return {
    issuerName,
    amount: request.amount,
    currency: "CZK",
    accountNumber: row.accountNumber,
    iban: row.iban,
    variableSymbol: request.variableSymbol,
    qrPayload,
    title: request.message?.trim() || "",
  };
}
