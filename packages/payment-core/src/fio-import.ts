export type FioRail = "domestic" | "sepa";

export type FioOrderLine = {
  amount: string;
  currency: string;
  beneficiaryName: string;
  beneficiaryIban?: string | null;
  beneficiaryAccountNumber?: string | null;
  beneficiaryBankCode?: string | null;
  beneficiaryBic?: string | null;
  variableSymbol?: string | null;
  constantSymbol?: string | null;
  specificSymbol?: string | null;
  messageForRecipient?: string | null;
  comment?: string | null;
  rail: FioRail;
};

const FIO_IMPORT_NS =
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.fio.cz/schema/importIB.xsd"';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function digitsOnly(
  value: string | null | undefined,
  max: number,
): string | undefined {
  if (!value) {
    return undefined;
  }
  const digits = value.replaceAll(/\D/g, "").slice(0, max);
  return digits.length > 0 ? digits : undefined;
}

function el(name: string, value: string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function accountFrom(accountNumber: string): string {
  return accountNumber.replace(/\/\d{4}$/u, "").replaceAll(/\s/g, "");
}

function buildDomestic(
  line: FioOrderLine,
  accountFromValue: string,
  date: string,
): string {
  const accountTo = line.beneficiaryAccountNumber
    ? line.beneficiaryAccountNumber.replaceAll(/\s/g, "")
    : "";
  const bankCode = line.beneficiaryBankCode ?? "";
  return [
    "<DomesticTransaction>",
    el("accountFrom", accountFromValue),
    el("currency", line.currency),
    el("amount", line.amount),
    el("accountTo", accountTo),
    el("bankCode", bankCode),
    el("ks", digitsOnly(line.constantSymbol, 4)),
    el("vs", digitsOnly(line.variableSymbol, 10)),
    el("ss", digitsOnly(line.specificSymbol, 10)),
    el("date", date),
    el(
      "messageForRecipient",
      (line.messageForRecipient ?? "").slice(0, 140) || undefined,
    ),
    el("comment", (line.comment ?? "").slice(0, 255) || undefined),
    el("benefName", line.beneficiaryName.slice(0, 35) || undefined),
    el("paymentType", "431001"),
    "</DomesticTransaction>",
  ]
    .filter(Boolean)
    .join("");
}

function buildT2(
  line: FioOrderLine,
  accountFromValue: string,
  date: string,
): string {
  return [
    "<T2Transaction>",
    el("accountFrom", accountFromValue),
    el("currency", line.currency),
    el("amount", line.amount),
    el("accountTo", (line.beneficiaryIban ?? "").replaceAll(/\s/g, "")),
    el("ks", digitsOnly(line.constantSymbol, 4)),
    el("vs", digitsOnly(line.variableSymbol, 10)),
    el("ss", digitsOnly(line.specificSymbol, 10)),
    el("bic", line.beneficiaryBic ?? undefined),
    el("date", date),
    el("benefName", line.beneficiaryName.slice(0, 35)),
    el(
      "remittanceInfo1",
      (line.messageForRecipient ?? "").slice(0, 35) || undefined,
    ),
    el("comment", (line.comment ?? "").slice(0, 255) || undefined),
    el("paymentType", "431008"),
    "</T2Transaction>",
  ]
    .filter(Boolean)
    .join("");
}

export function classifyFioRail(input: {
  iban?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
}): FioRail | "foreign" {
  const iban = (input.iban ?? "").replaceAll(/\s/g, "").toUpperCase();
  if (input.accountNumber && input.bankCode) {
    return "domestic";
  }
  if (/^CZ\d{2}2010/u.test(iban) || /^SK\d{2}8330/u.test(iban)) {
    return "domestic";
  }
  if (/^CZ/u.test(iban)) {
    return "domestic";
  }
  if (
    /^(AT|BE|BG|CY|DE|EE|ES|FI|FR|GR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PT|RO|SE|SI|SK)/u.test(
      iban,
    )
  ) {
    return "sepa";
  }
  if (iban) {
    return "foreign";
  }
  return "foreign";
}

export function buildFioImportXml(input: {
  accountFrom: string;
  currency: string;
  executionDate: string;
  lines: FioOrderLine[];
}): { xml: string; byteLength: number } {
  const accountFromValue = accountFrom(input.accountFrom);
  const domestic = input.lines.filter((line) => line.rail === "domestic");
  const sepa = input.lines.filter((line) => line.rail === "sepa");
  const orders = [
    ...domestic.map((line) =>
      buildDomestic(line, accountFromValue, input.executionDate),
    ),
    ...sepa.map((line) => buildT2(line, accountFromValue, input.executionDate)),
  ].join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Import ${FIO_IMPORT_NS}><Orders>${orders}</Orders></Import>`;
  return { xml, byteLength: Buffer.byteLength(xml, "utf8") };
}

export function splitFioImportBatches(input: {
  accountFrom: string;
  currency: string;
  executionDate: string;
  lines: FioOrderLine[];
}): Array<{ xml: string; byteLength: number; lines: FioOrderLine[] }> {
  const batches: Array<{
    xml: string;
    byteLength: number;
    lines: FioOrderLine[];
  }> = [];
  let current: FioOrderLine[] = [];
  for (const line of input.lines) {
    const candidate = [...current, line];
    const built = buildFioImportXml({ ...input, lines: candidate });
    if (built.byteLength > MAX_IMPORT_BYTES && current.length > 0) {
      batches.push({
        ...buildFioImportXml({ ...input, lines: current }),
        lines: current,
      });
      current = [line];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    batches.push({
      ...buildFioImportXml({ ...input, lines: current }),
      lines: current,
    });
  }
  return batches;
}

export type FioImportResult =
  | {
      ok: true;
      status: "ok" | "warning";
      errorCode: string;
      idInstruction?: string;
      sumDebet?: string;
      sumCredit?: string;
      message?: string;
    }
  | {
      ok: false;
      status: "error" | "fatal" | "unknown";
      errorCode?: string;
      message?: string;
      httpStatus?: number;
    };

function textBetween(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "u").exec(xml);
  return match?.[1];
}

export function parseFioImportResponse(xml: string): FioImportResult {
  const errorCode = textBetween(xml, "errorCode") ?? "0";
  const status = (textBetween(xml, "status") ?? "ok").toLowerCase();
  const message =
    textBetween(xml, "message") ?? textBetween(xml, "errorMessage");
  const idInstruction = textBetween(xml, "idInstruction");
  const sumDebet = textBetween(xml, "sumDebet");
  const sumCredit = textBetween(xml, "sumCredit");

  if (status === "fatal") {
    return { ok: false, status: "fatal", errorCode, message };
  }
  if (errorCode === "0" || status === "ok") {
    return {
      ok: true,
      status: "ok",
      errorCode,
      idInstruction,
      sumDebet,
      sumCredit,
      message,
    };
  }
  if (errorCode === "2" || status === "warning") {
    return {
      ok: true,
      status: "warning",
      errorCode,
      idInstruction,
      sumDebet,
      sumCredit,
      message,
    };
  }
  return { ok: false, status: "error", errorCode, message };
}

export async function submitFioImport(input: {
  token: string;
  xml: string;
  lang?: "cs" | "en";
  fetchImpl?: typeof fetch;
}): Promise<FioImportResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new FormData();
  body.set("token", input.token);
  body.set("type", "xml");
  body.set("lng", input.lang ?? "cs");
  body.set(
    "file",
    new Blob([input.xml], { type: "application/xml" }),
    "import.xml",
  );

  let response: Response;
  try {
    response = await fetchImpl("https://fioapi.fio.cz/v1/rest/import/", {
      method: "POST",
      body,
    });
  } catch {
    return { ok: false, status: "unknown", message: "transport_timeout" };
  }

  if (response.status === 409) {
    return {
      ok: false,
      status: "error",
      httpStatus: 409,
      message: "throttled",
    };
  }
  if (response.status === 500) {
    return {
      ok: false,
      status: "error",
      httpStatus: 500,
      message: "token_inactive",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      status: "error",
      httpStatus: 404,
      message: "malformed_url",
    };
  }
  const text = await response.text();
  return parseFioImportResponse(text);
}

export const FIO_IMPORT_MAX_BYTES = MAX_IMPORT_BYTES;
