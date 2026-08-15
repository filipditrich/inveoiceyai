import { createHash } from "node:crypto";

import { minorToDecimal } from "./money";
import type {
  DiscoveredBankAccount,
  NormalizedBankTransaction,
  NormalizedTransactionBatch,
} from "./types";

const FIO_BASE_URL = "https://fioapi.fio.cz/v1/rest";
const PRAGUE_TIME_ZONE = "Europe/Prague";

type JsonRecord = Record<string, unknown>;

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`fio_invalid_${field}`);
  }
  return value as JsonRecord;
}

function optionalRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function column(row: JsonRecord, name: string): JsonRecord | null {
  return optionalRecord(row[name]);
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function columnText(row: JsonRecord, name: string): string | null {
  return textValue(column(row, name)?.value);
}

function requiredColumnText(
  row: JsonRecord,
  name: string,
  field: string,
): string {
  const value = columnText(row, name);
  if (!value) throw new Error(`fio_missing_${field}`);
  return value;
}

function requiredInfoText(info: JsonRecord, name: string): string {
  const value = textValue(info[name]);
  if (!value) throw new Error(`fio_missing_${name}`);
  return value;
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
  if (!parsed) throw new Error(`fio_invalid_${field}`);
  return parsed;
}

function fioDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) {
    return value.slice(0, 10);
  }
  const timestamp = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function hashTransactionPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeAccount(info: JsonRecord): DiscoveredBankAccount {
  const accountId = requiredInfoText(info, "accountId");
  const bankCode = requiredInfoText(info, "bankId").padStart(4, "0");
  return {
    provider: "fio",
    providerAccountId: accountId,
    accountNumber: `${accountId}/${bankCode}`,
    bankCode,
    iban: requiredInfoText(info, "iban").replace(/\s+/gu, "").toUpperCase(),
    bic: requiredInfoText(info, "bic").toUpperCase(),
    currency: requiredInfoText(info, "currency").toUpperCase(),
    openingBalance: moneyValue(info.openingBalance),
    closingBalance: moneyValue(info.closingBalance),
  };
}

function normalizeTransaction(row: JsonRecord): NormalizedBankTransaction {
  const amount = requiredMoney(column(row, "column1")?.value, "amount");
  const amountMinor = BigInt(amount.replace(".", ""));
  const bookingDate = fioDate(column(row, "column0")?.value);
  if (!bookingDate) throw new Error("fio_invalid_booking_date");
  return {
    provider: "fio",
    providerTransactionId: requiredColumnText(row, "column22", "movement_id"),
    providerInstructionId: columnText(row, "column17"),
    bookingDate,
    amount: minorToDecimal(amountMinor),
    currency: requiredColumnText(row, "column14", "currency").toUpperCase(),
    direction: amountMinor >= BigInt(0) ? "credit" : "debit",
    counterpartyAccount: columnText(row, "column2"),
    counterpartyBankCode: columnText(row, "column3"),
    counterpartyName: columnText(row, "column10"),
    counterpartyBankName: columnText(row, "column12"),
    bic: columnText(row, "column26")?.toUpperCase() ?? null,
    variableSymbol: columnText(row, "column5"),
    constantSymbol: columnText(row, "column4"),
    specificSymbol: columnText(row, "column6"),
    message: columnText(row, "column16"),
    userIdentification: columnText(row, "column7"),
    detail: columnText(row, "column18"),
    comment: columnText(row, "column25"),
    payerReference: columnText(row, "column27"),
    providerType: requiredColumnText(row, "column8", "type"),
    providerPayloadHash: hashTransactionPayload(row),
  };
}

export function parseFioResponse(payload: unknown): NormalizedTransactionBatch {
  const root = record(payload, "response");
  const statement = record(root.accountStatement, "account_statement");
  const info = record(statement.info, "info");
  const transactionList = optionalRecord(statement.transactionList);
  const raw = transactionList?.transaction;
  const rows = raw
    ? Array.isArray(raw)
      ? raw.map((value) => record(value, "transaction"))
      : [record(raw, "transaction")]
    : [];
  return {
    account: normalizeAccount(info),
    transactions: rows.map(normalizeTransaction),
    from: fioDate(info.dateStart),
    to: fioDate(info.dateEnd),
  };
}

export function buildFioPeriodsUrl(input: {
  token: string;
  from: string;
  to: string;
}): string {
  const token = input.token.trim();
  if (!isValidFioTokenShape(token)) {
    throw new Error("fio_invalid_token_shape");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.from) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(input.to)
  ) {
    throw new Error("fio_invalid_date_range");
  }
  return `${FIO_BASE_URL}/periods/${encodeURIComponent(token)}/${input.from}/${input.to}/transactions.json`;
}

/** Fio documents the token as a unique 64-character string. */
export function isValidFioTokenShape(value: string): boolean {
  const token = value.trim();
  return token.length === 64 && !/\s/u.test(token);
}

export async function fetchFioTransactions(input: {
  token: string;
  from: string;
  to: string;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedTransactionBatch> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(buildFioPeriodsUrl(input), {
    method: "GET",
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const status = response.status;
    if (status === 409) throw new Error("fio_throttled");
    if (status === 413) throw new Error("fio_too_many_movements");
    if (status === 422) throw new Error("fio_history_locked");
    if (status === 500) throw new Error("fio_token_inactive");
    throw new Error(`fio_http_${status}`);
  }
  return parseFioResponse(await response.json());
}
