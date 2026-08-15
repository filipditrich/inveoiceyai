export type BankDirection = "credit" | "debit";

export interface DiscoveredBankAccount {
  provider: "fio";
  providerAccountId: string;
  accountNumber: string;
  bankCode: string;
  iban: string;
  bic: string;
  currency: string;
  openingBalance: string | null;
  closingBalance: string | null;
}

export interface NormalizedBankTransaction {
  provider: "fio";
  providerTransactionId: string;
  providerInstructionId: string | null;
  bookingDate: string;
  amount: string;
  currency: string;
  direction: BankDirection;
  counterpartyAccount: string | null;
  counterpartyBankCode: string | null;
  counterpartyName: string | null;
  counterpartyBankName: string | null;
  bic: string | null;
  variableSymbol: string | null;
  constantSymbol: string | null;
  specificSymbol: string | null;
  message: string | null;
  userIdentification: string | null;
  detail: string | null;
  comment: string | null;
  payerReference: string | null;
  providerType: string;
  providerPayloadHash: string;
}

export interface NormalizedTransactionBatch {
  account: DiscoveredBankAccount;
  transactions: NormalizedBankTransaction[];
  from: string | null;
  to: string | null;
}
