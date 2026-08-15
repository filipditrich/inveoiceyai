import { createHash } from "node:crypto";

import { minorToDecimal } from "./money";
import type {
  DiscoveredBankAccount,
  NormalizedBankTransaction,
  NormalizedTransactionBatch,
} from "./types";

const MONETA_BASE_URL = "https://api.moneta.cz";
const MONETA_AISP_PREFIX = "/api/v4/vip/aisp/my";

/** Query keys for transaction date range (VIP AISP). Easy to correct if docs differ. */
export const MONETA_TX_DATE_FROM_PARAM = "fromDate";
export const MONETA_TX_DATE_TO_PARAM = "toDate";

const MIN_TOKEN_LENGTH = 16;
const MAX_TOKEN_LENGTH = 512;

type JsonRecord = Record<string, unknown>;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`moneta_invalid_${field}`);
  }
  return value as JsonRecord;
}

function optionalRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function pathValue(root: JsonRecord, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as JsonRecord)[key];
  }
  return current;
}

function pathText(root: JsonRecord, path: string[]): string | null {
  return textValue(pathValue(root, path));
}

function moneyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toFixed(2);
  }
  const text = String(value).trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/u.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function requiredMoney(value: unknown, field: string): string {
  const parsed = moneyValue(value);
  if (!parsed) throw new Error(`moneta_invalid_${field}`);
  return parsed;
}

function dateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) {
    return value.slice(0, 10);
  }
  return null;
}

function hashTransactionPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Account-holder API tokens are opaque; reject empty / whitespace / extremes. */
export function isValidMonetaTokenShape(value: string): boolean {
  const token = value.trim();
  return (
    token.length >= MIN_TOKEN_LENGTH &&
    token.length <= MAX_TOKEN_LENGTH &&
    !/\s/u.test(token)
  );
}

export function extractMonetaPaymentSymbols(reference: string | null): {
  variableSymbol: string | null;
  constantSymbol: string | null;
  specificSymbol: string | null;
} {
  if (!reference) {
    return {
      variableSymbol: null,
      constantSymbol: null,
      specificSymbol: null,
    };
  }
  const vs = /\bVS:([0-9]+)\b/iu.exec(reference);
  const ks = /\bKS:([0-9]+)\b/iu.exec(reference);
  const ss = /\bSS:([0-9]+)\b/iu.exec(reference);
  return {
    variableSymbol: vs?.[1] ?? null,
    constantSymbol: ks?.[1] ?? null,
    specificSymbol: ss?.[1] ?? null,
  };
}

function czechAccountNumber(iban: string, bankCode: string): string {
  const compact = iban.replace(/\s+/gu, "").toUpperCase();
  /** CZ IBAN: country(2) + check(2) + bank(4) + account(16) */
  if (/^CZ\d{22}$/u.test(compact)) {
    const account = compact.slice(8).replace(/^0+/u, "") || "0";
    const code = bankCode || compact.slice(4, 8);
    return `${account}/${code}`;
  }
  return bankCode ? `${compact}/${bankCode}` : compact;
}

export function normalizeMonetaAccount(raw: unknown): DiscoveredBankAccount {
  const account = record(raw, "account");
  const id = textValue(account.id);
  if (!id) throw new Error("moneta_missing_account_id");
  const currency = textValue(account.currency)?.toUpperCase();
  if (!currency) throw new Error("moneta_missing_currency");
  const iban = pathText(account, ["identification", "iban"])
    ?.replace(/\s+/gu, "")
    .toUpperCase();
  if (!iban) throw new Error("moneta_missing_iban");
  const bankCode = (pathText(account, ["servicer", "bankCode"]) ?? "").padStart(
    4,
    "0",
  );
  const bic = pathText(account, ["servicer", "bic"])?.toUpperCase() ?? "";
  return {
    provider: "moneta",
    providerAccountId: id,
    accountNumber: czechAccountNumber(iban, bankCode),
    bankCode,
    iban,
    bic: bic || "AGBACZPP",
    currency,
    openingBalance: null,
    closingBalance: null,
    name: textValue(account.nameI18N),
  };
}

export function normalizeMonetaTransaction(
  raw: unknown,
): NormalizedBankTransaction {
  const row = record(raw, "transaction");
  const entryReference = textValue(row.entryReference);
  if (!entryReference) throw new Error("moneta_missing_entry_reference");
  const indicator = textValue(row.creditDebitIndicator)?.toUpperCase();
  if (indicator !== "CRDT" && indicator !== "DBIT") {
    throw new Error("moneta_invalid_credit_debit_indicator");
  }
  const amountObj = optionalRecord(row.amount) ?? {};
  const amount = requiredMoney(amountObj.value, "amount");
  const amountMinor = BigInt(amount.replace(".", ""));
  const currency = textValue(amountObj.currency)?.toUpperCase();
  if (!currency) throw new Error("moneta_missing_currency");
  const bookingDate = dateOnly(pathValue(row, ["bookingDate", "date"]));
  if (!bookingDate) throw new Error("moneta_invalid_booking_date");

  const details = optionalRecord(
    pathValue(row, ["entryDetails", "transactionDetails"]),
  );
  const creditorReference = details
    ? pathText(details, [
        "remittanceInformation",
        "structured",
        "creditorReferenceInformation",
        "reference",
      ])
    : null;
  const symbols = extractMonetaPaymentSymbols(creditorReference);
  const purpose = details
    ? pathText(details, ["purpose", "proprietary"])
    : null;
  const description = details
    ? pathText(details, ["references", "transactionDescription"])
    : null;
  const counterpartyName =
    (details
      ? pathText(details, ["relatedParties", "debtor", "name"])
      : null) ??
    (details
      ? pathText(details, ["relatedParties", "creditor", "name"])
      : null);
  const counterpartyIban =
    (details
      ? pathText(details, [
          "relatedParties",
          "debtorAccount",
          "identification",
          "iban",
        ])
      : null) ??
    (details
      ? pathText(details, [
          "relatedParties",
          "creditorAccount",
          "identification",
          "iban",
        ])
      : null);

  return {
    provider: "moneta",
    providerTransactionId: entryReference,
    providerInstructionId: null,
    bookingDate,
    amount: minorToDecimal(
      amountMinor < BigInt(0) ? -amountMinor : amountMinor,
    ),
    currency,
    direction: indicator === "CRDT" ? "credit" : "debit",
    counterpartyAccount: counterpartyIban,
    counterpartyBankCode: null,
    counterpartyName,
    counterpartyBankName: null,
    bic: null,
    variableSymbol: symbols.variableSymbol,
    constantSymbol: symbols.constantSymbol,
    specificSymbol: symbols.specificSymbol,
    message: description ?? purpose ?? creditorReference,
    userIdentification: null,
    detail: purpose,
    comment: null,
    payerReference: creditorReference,
    providerType: textValue(row.status) ?? indicator,
    providerPayloadHash: hashTransactionPayload(row),
  };
}

function authHeaders(token: string): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${token.trim()}`,
    application_name: "Invoicey",
  };
}

function throwForMonetaStatus(status: number): never {
  if (status === 401) throw new Error("moneta_unauthorized");
  if (status === 403) throw new Error("moneta_forbidden");
  if (status === 404) throw new Error("moneta_not_found");
  if (status === 429) throw new Error("moneta_throttled");
  throw new Error(`moneta_http_${status}`);
}

async function monetaGetJson(input: {
  token: string;
  path: string;
  query?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<JsonRecord> {
  if (!isValidMonetaTokenShape(input.token)) {
    throw new Error("moneta_invalid_token_shape");
  }
  const url = new URL(`${MONETA_BASE_URL}${input.path}`);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    headers: authHeaders(input.token),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throwForMonetaStatus(response.status);
  return record(await response.json(), "response");
}

export function parseMonetaAccountsResponse(
  payload: unknown,
): DiscoveredBankAccount[] {
  const root = record(payload, "accounts_response");
  const raw = root.accounts;
  if (!raw) return [];
  if (!Array.isArray(raw)) throw new Error("moneta_invalid_accounts");
  return raw.map((row) => normalizeMonetaAccount(row));
}

export async function listMonetaAccounts(input: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<DiscoveredBankAccount[]> {
  const payload = await monetaGetJson({
    token: input.token,
    path: `${MONETA_AISP_PREFIX}/accounts`,
    fetchImpl: input.fetchImpl,
  });
  return parseMonetaAccountsResponse(payload);
}

export async function fetchMonetaTransactions(input: {
  token: string;
  accountId: string;
  from: string;
  to: string;
  account?: DiscoveredBankAccount;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedTransactionBatch> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.from) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.to)
  ) {
    throw new Error("moneta_invalid_date_range");
  }
  const accountId = input.accountId.trim();
  if (!accountId) throw new Error("moneta_missing_account_id");

  let account = input.account;
  if (!account) {
    const accounts = await listMonetaAccounts({
      token: input.token,
      fetchImpl: input.fetchImpl,
    });
    account = accounts.find((row) => row.providerAccountId === accountId);
    if (!account) throw new Error("moneta_account_not_in_token");
  }

  const transactions: NormalizedBankTransaction[] = [];
  let pageNumber = 0;
  let pageCount = 1;
  while (pageNumber < pageCount) {
    const payload = await monetaGetJson({
      token: input.token,
      path: `${MONETA_AISP_PREFIX}/accounts/${encodeURIComponent(accountId)}/transactions`,
      query: {
        [MONETA_TX_DATE_FROM_PARAM]: input.from,
        [MONETA_TX_DATE_TO_PARAM]: input.to,
        pageNumber: String(pageNumber),
      },
      fetchImpl: input.fetchImpl,
    });
    const raw = payload.transactions;
    if (raw) {
      if (!Array.isArray(raw)) throw new Error("moneta_invalid_transactions");
      for (const row of raw) {
        transactions.push(normalizeMonetaTransaction(row));
      }
    }
    const reportedCount = Number(payload.pageCount);
    pageCount =
      Number.isFinite(reportedCount) && reportedCount > 0 ? reportedCount : 1;
    pageNumber += 1;
    if (pageNumber > 100) throw new Error("moneta_too_many_pages");
  }

  return {
    account,
    transactions,
    from: input.from,
    to: input.to,
  };
}
