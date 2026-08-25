export function paymentRunRelationshipsAreValid(input: {
  workspaceId: string;
  issuerId: string;
  bankAccountId: string;
  currency: string;
  issuer: { id: string; workspaceId: string } | undefined;
  bankAccount:
    { id: string; workspaceId: string; currency: string } | undefined;
  accountIssuer:
    | {
        workspaceId: string;
        bankAccountId: string;
        issuerId: string;
      }
    | undefined;
  invoices: Array<{ workspaceId: string; issuerId: string }>;
  selectedInvoiceCount: number;
}): boolean {
  return (
    input.issuer?.id === input.issuerId &&
    input.issuer.workspaceId === input.workspaceId &&
    input.bankAccount?.id === input.bankAccountId &&
    input.bankAccount.workspaceId === input.workspaceId &&
    input.bankAccount.currency === input.currency &&
    input.accountIssuer?.workspaceId === input.workspaceId &&
    input.accountIssuer.bankAccountId === input.bankAccountId &&
    input.accountIssuer.issuerId === input.issuerId &&
    input.invoices.length === input.selectedInvoiceCount &&
    input.invoices.every(
      (invoice) =>
        invoice.workspaceId === input.workspaceId &&
        invoice.issuerId === input.issuerId,
    )
  );
}

/**
 * The database-specific claim must be conditional (`active_payment_run_id IS NULL`).
 * This small seam makes the resulting one-winner rule testable without a live DB.
 */
export async function claimPaymentRunCandidates<T>(
  candidates: readonly T[],
  deps: {
    isEligible: (candidate: T) => Promise<boolean>;
    conditionallyClaim: (candidate: T) => Promise<boolean>;
    insertClaimedLine: (candidate: T) => Promise<void>;
  },
): Promise<number> {
  let claimed = 0;
  for (const candidate of candidates) {
    if (!(await deps.isEligible(candidate))) continue;
    if (!(await deps.conditionallyClaim(candidate))) continue;
    await deps.insertClaimedLine(candidate);
    claimed += 1;
  }
  return claimed;
}
