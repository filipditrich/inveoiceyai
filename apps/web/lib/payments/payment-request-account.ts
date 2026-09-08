import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";

import {
  bankAccountIssuers,
  bankAccounts,
  bankConnections,
  issuerBusinesses,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { IssuerSnapshotSchema } from "@invoicey/invoice-core/schema";

export type CollectingAccount = {
  issuerId: string;
  issuerName: string;
  bankAccountId: string;
  connectionId: string;
  accountNumber: string;
  iban: string;
  bic: string | null;
};

/**
 * Default issuer plus the CZK account Invoicey can watch for a standalone
 * request. Prefers the connection that last synced successfully, same idea as
 * invoice collection.
 */
export async function resolveCollectingAccount(
  workspaceId: string,
): Promise<CollectingAccount | null> {
  const [row] = await db
    .select({
      issuerId: issuerBusinesses.id,
      issuerSnapshot: issuerBusinesses.snapshot,
      issuerIsDefault: issuerBusinesses.isDefault,
      bankAccountId: bankAccounts.id,
      connectionId: bankConnections.id,
      accountNumber: bankAccounts.accountNumber,
      iban: bankAccounts.iban,
      bic: bankAccounts.bic,
      lastSyncSucceededAt: bankConnections.lastSyncSucceededAt,
    })
    .from(issuerBusinesses)
    .innerJoin(
      bankAccountIssuers,
      and(
        eq(bankAccountIssuers.issuerId, issuerBusinesses.id),
        eq(bankAccountIssuers.workspaceId, issuerBusinesses.workspaceId),
      ),
    )
    .innerJoin(
      bankAccounts,
      and(
        eq(bankAccounts.id, bankAccountIssuers.bankAccountId),
        eq(bankAccounts.workspaceId, issuerBusinesses.workspaceId),
        eq(bankAccounts.currency, "CZK"),
      ),
    )
    .innerJoin(
      bankConnections,
      and(
        eq(bankConnections.id, bankAccounts.connectionId),
        eq(bankConnections.workspaceId, issuerBusinesses.workspaceId),
        eq(bankConnections.status, "active"),
        inArray(bankConnections.provider, ["fio", "moneta"]),
      ),
    )
    .where(eq(issuerBusinesses.workspaceId, workspaceId))
    .orderBy(
      desc(issuerBusinesses.isDefault),
      desc(bankConnections.lastSyncSucceededAt),
    )
    .limit(1);

  if (!row) return null;
  const parsed = IssuerSnapshotSchema.safeParse(row.issuerSnapshot);
  if (!parsed.success) return null;

  return {
    issuerId: row.issuerId,
    issuerName: parsed.data.name,
    bankAccountId: row.bankAccountId,
    connectionId: row.connectionId,
    accountNumber: row.accountNumber,
    iban: row.iban,
    bic: row.bic,
  };
}
