type SelectableInvoice = {
  id: string;
  issuerId: string | null;
  currency: string;
};

type PayingAccount = {
  currency: string;
  issuerIds: readonly string[];
};

export function paymentRunSelection<TRow extends SelectableInvoice>(
  rows: readonly TRow[],
  selectedIds: readonly string[],
) {
  const selected = rows.find((row) => selectedIds.includes(row.id));
  if (!selected?.issuerId) {
    return {
      issuerId: null,
      currency: null,
      compatibleIds: rows.map((row) => row.id),
    };
  }
  return {
    issuerId: selected.issuerId,
    currency: selected.currency,
    compatibleIds: rows
      .filter(
        (row) =>
          row.issuerId === selected.issuerId &&
          row.currency === selected.currency,
      )
      .map((row) => row.id),
  };
}

export function compatiblePaymentRunAccounts<TAccount extends PayingAccount>(
  accounts: readonly TAccount[],
  issuerId: string | null,
  currency: string | null,
): TAccount[] {
  if (!issuerId || !currency) return [];
  return accounts.filter(
    (account) =>
      account.currency === currency && account.issuerIds.includes(issuerId),
  );
}
