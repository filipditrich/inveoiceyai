/**
 * ISDOC 6.0.2 → InvoiceSchema mapper (inverse of render-isdoc).
 */
import { convert } from "xmlbuilder2";
import { randomUUID } from "node:crypto";

import type {
  Invoice,
  InvoiceCurrency,
  InvoiceLanguage,
  IssuerSnapshot,
} from "../schema";
import {
  InvoiceCurrencySchema,
  InvoiceLanguageSchema,
  InvoiceSchema,
} from "../schema";
import { czechAccountToIban } from "../bank/czech-iban";
import { ISDOC_XML_NAMESPACE } from "./render-isdoc";

export type ParseIsdocOptions = {
  issuer: IssuerSnapshot;
  clientId?: string;
};

export type ParseIsdocResult = {
  invoice: Invoice;
  isdocUuid?: string;
  softwareName?: string;
  supplierIco?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function textOf(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }
  const rec = asRecord(value);
  if (!rec) {
    return "";
  }
  if ("#" in rec) {
    return textOf(rec["#"]);
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "@version" || k.startsWith("@")) {
      continue;
    }
    const t = textOf(v);
    if (t) {
      return t;
    }
  }
  return "";
}

function attrOf(value: unknown, name: string): string {
  const rec = asRecord(value);
  if (!rec) {
    return "";
  }
  const direct = rec[`@${name}`];
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct).trim();
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === `@${name}` || k.endsWith(`:${name}`) || k.endsWith(`}${name}`)) {
      if (typeof v === "string" || typeof v === "number") {
        return String(v).trim();
      }
    }
  }
  return "";
}

function child(node: unknown, localName: string): unknown {
  const rec = asRecord(node);
  if (!rec) {
    return undefined;
  }
  if (localName in rec) {
    return rec[localName];
  }
  const nsKey = `${ISDOC_XML_NAMESPACE}:${localName}`;
  if (nsKey in rec) {
    return rec[nsKey];
  }
  for (const [k, v] of Object.entries(rec)) {
    if (
      k === localName ||
      k.endsWith(`:${localName}`) ||
      k.endsWith(`}${localName}`)
    ) {
      return v;
    }
  }
  return undefined;
}

function children(node: unknown, localName: string): unknown[] {
  const raw = child(node, localName);
  if (raw == null) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

function numOf(value: unknown, fallback = 0): number {
  const t = textOf(value).replace(",", ".");
  if (!t) {
    return fallback;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function docTypeFromIsdoc(code: string): Invoice["meta"]["docType"] {
  switch (code.trim()) {
    case "1":
      return "invoice";
    case "2":
      return "credit_note";
    case "4":
      return "proforma";
    case "5":
      return "advance";
    default:
      return "invoice";
  }
}

function paymentMethodFromCode(code: string): Invoice["payment"]["method"] {
  switch (code.trim()) {
    case "10":
      return "cash";
    case "48":
      return "card";
    case "42":
    default:
      return "transfer";
  }
}

function unitFromCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (c === "HUR") {
    return "hod";
  }
  return "ks";
}

function formatCzZip(raw: string): string {
  const digits = raw.replaceAll(/\s+/g, "");
  if (/^\d{5}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return raw.trim() || "000 00";
}

function formatAccount(number: string, bankCode: string): string {
  const n = number.trim();
  const b = bankCode.trim();
  if (!n || !b) {
    return "";
  }
  return `${n}/${b}`;
}

function partyName(party: unknown): string {
  return textOf(child(child(party, "PartyName"), "Name"));
}

function partyIco(party: unknown): string | undefined {
  const id = textOf(child(child(party, "PartyIdentification"), "ID"));
  return /^\d{8}$/.test(id) ? id : undefined;
}

function partyDic(party: unknown): string | undefined {
  const tax = child(party, "PartyTaxScheme");
  const companyId = textOf(child(tax, "CompanyID"));
  return companyId || undefined;
}

function partyEmail(party: unknown): string | undefined {
  const mail = textOf(child(child(party, "Contact"), "ElectronicMail"));
  return mail.includes("@") ? mail : undefined;
}

function partyAddress(party: unknown): Invoice["client"]["address"] {
  const addr = child(party, "PostalAddress");
  const street = textOf(child(addr, "StreetName"));
  const building = textOf(child(addr, "BuildingNumber"));
  const city = textOf(child(addr, "CityName"));
  const zip = textOf(child(addr, "PostalZone"));
  const country =
    textOf(child(child(addr, "Country"), "IdentificationCode")).toUpperCase() ||
    "CZ";
  return {
    street: [street, building].filter(Boolean).join(" ").trim() || "—",
    city: city || "—",
    zip: formatCzZip(zip),
    country: /^[A-Z]{2}$/.test(country) ? country : "CZ",
  };
}

function findInvoiceRoot(converted: unknown): unknown {
  const rec = asRecord(converted);
  if (!rec) {
    return null;
  }
  if ("Invoice" in rec) {
    return rec.Invoice;
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "Invoice" || k.endsWith(":Invoice") || k.endsWith("}Invoice")) {
      return v;
    }
  }
  if (child(rec, "DocumentType") != null || child(rec, "ID") != null) {
    return rec;
  }
  return null;
}

/**
 * Parse ISDOC 6.0.x XML into a validated Invoice.
 * Issuer comes from `options.issuer`; client/lines/meta from XML.
 */
export function parseIsdoc(
  xml: string,
  options: ParseIsdocOptions,
): ParseIsdocResult {
  const converted = convert(xml, { format: "object" });
  const root = findInvoiceRoot(converted);
  if (!root) {
    throw new Error("isdoc_missing_invoice_root");
  }

  const docType = docTypeFromIsdoc(textOf(child(root, "DocumentType")));
  const number = textOf(child(root, "ID"));
  if (!number) {
    throw new Error("isdoc_missing_number");
  }
  const issueDate = textOf(child(root, "IssueDate"));
  const duzpRaw = textOf(child(root, "TaxPointDate"));
  const duzp = duzpRaw || issueDate;
  const isdocUuid = textOf(child(root, "UUID")) || undefined;
  const softwareName =
    textOf(child(root, "SoftwareName")) ||
    textOf(child(child(root, "Extensions"), "SoftwareName")) ||
    undefined;

  const supplierParty = child(child(root, "AccountingSupplierParty"), "Party");
  const customerParty = child(child(root, "AccountingCustomerParty"), "Party");
  const supplierIco = partyIco(supplierParty);

  const clientName = partyName(customerParty) || "Neznámý odběratel";
  const client: Invoice["client"] = {
    id: options.clientId ?? randomUUID(),
    name: clientName,
    ico: partyIco(customerParty),
    dic: partyDic(customerParty) as Invoice["client"]["dic"],
    address: partyAddress(customerParty),
    contactEmail: partyEmail(customerParty),
  };

  const lineNodes = children(child(root, "InvoiceLines"), "InvoiceLine");
  const items: Invoice["items"] = lineNodes.map((line, index) => {
    const qty = numOf(child(line, "InvoicedQuantity"), 1);
    const unitCode =
      asRecord(child(line, "InvoicedQuantity"))?.["@unitCode"] != null
        ? String(asRecord(child(line, "InvoicedQuantity"))!["@unitCode"])
        : "C62";
    const vatRate = Math.round(
      numOf(child(child(line, "ClassifiedTaxCategory"), "Percent"), 0),
    );
    const lineSubtotal = numOf(child(line, "LineExtensionAmount"));
    const lineVat = numOf(child(line, "LineExtensionTaxAmount"));
    const lineTotal = numOf(
      child(line, "LineExtensionAmountTaxInclusive"),
      lineSubtotal + lineVat,
    );
    const unitPrice = numOf(
      child(line, "UnitPrice"),
      qty !== 0 ? lineSubtotal / qty : 0,
    );
    const description =
      textOf(child(child(line, "Item"), "Description")) ||
      `Položka ${index + 1}`;
    return {
      position: Number(textOf(child(line, "ID"))) || index + 1,
      description,
      quantity: qty || 1,
      unit: unitFromCode(unitCode),
      unitPriceWithoutVat: Math.max(0, unitPrice),
      vatRate,
      lineSubtotal,
      lineVat,
      lineTotal,
    };
  });

  if (items.length === 0) {
    const payable = numOf(
      child(child(root, "LegalMonetaryTotal"), "PayableAmount"),
    );
    const exclusive = numOf(
      child(child(root, "LegalMonetaryTotal"), "TaxExclusiveAmount"),
      payable,
    );
    const tax = numOf(
      child(child(root, "TaxTotal"), "TaxAmount"),
      payable - exclusive,
    );
    items.push({
      position: 1,
      description: "Importovaná položka",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: Math.max(0, exclusive),
      vatRate: exclusive > 0 ? Math.round((tax / exclusive) * 100) : 0,
      lineSubtotal: exclusive,
      lineVat: tax,
      lineTotal: payable || exclusive + tax,
    });
  }

  const vatBreakdownMap = new Map<number, { base: number; vat: number }>();
  for (const st of children(child(root, "TaxTotal"), "TaxSubTotal")) {
    const rate = Math.round(
      numOf(child(child(st, "TaxCategory"), "Percent"), 0),
    );
    const base = numOf(child(st, "TaxableAmount"));
    const vat = numOf(child(st, "TaxAmount"));
    const prev = vatBreakdownMap.get(rate) ?? { base: 0, vat: 0 };
    vatBreakdownMap.set(rate, { base: prev.base + base, vat: prev.vat + vat });
  }
  let vatBreakdown = [...vatBreakdownMap.entries()].map(([rate, v]) => ({
    rate,
    base: v.base,
    vat: v.vat,
  }));
  if (vatBreakdown.length === 0) {
    const byRate = new Map<number, { base: number; vat: number }>();
    for (const line of items) {
      const prev = byRate.get(line.vatRate) ?? { base: 0, vat: 0 };
      byRate.set(line.vatRate, {
        base: prev.base + line.lineSubtotal,
        vat: prev.vat + line.lineVat,
      });
    }
    vatBreakdown = [...byRate.entries()].map(([rate, v]) => ({
      rate,
      base: v.base,
      vat: v.vat,
    }));
  }

  const subtotal = numOf(
    child(child(root, "LegalMonetaryTotal"), "TaxExclusiveAmount"),
    items.reduce((s, l) => s + l.lineSubtotal, 0),
  );
  const total = numOf(
    child(child(root, "LegalMonetaryTotal"), "PayableAmount"),
    items.reduce((s, l) => s + l.lineTotal, 0),
  );
  const vatTotal = numOf(
    child(child(root, "TaxTotal"), "TaxAmount"),
    items.reduce((s, l) => s + l.lineVat, 0),
  );

  const paymentNode = children(child(root, "PaymentMeans"), "Payment")[0];
  const meansCode = textOf(child(paymentNode, "PaymentMeansCode")) || "42";
  const details = child(paymentNode, "Details");
  const dueDate =
    textOf(child(details, "PaymentDueDate")) ||
    textOf(child(root, "PaymentDueDate")) ||
    issueDate;

  const accountNumber = formatAccount(
    textOf(child(details, "ID")),
    textOf(child(details, "BankCode")),
  );
  const iban = textOf(child(details, "IBAN"));
  const bic = textOf(child(details, "BIC")) || undefined;
  const method = paymentMethodFromCode(meansCode);

  const payment: Invoice["payment"] = {
    method,
    variableSymbol: textOf(child(details, "VariableSymbol")) || undefined,
    constantSymbol: textOf(child(details, "ConstantSymbol")) || undefined,
    specificSymbol: textOf(child(details, "SpecificSymbol")) || undefined,
  };

  if (method === "transfer") {
    payment.bankAccount =
      accountNumber && /^CZ\d{22}$/.test(iban)
        ? {
            accountNumber: accountNumber || options.issuer.bank.accountNumber,
            iban: iban || options.issuer.bank.iban,
            bic: bic ?? options.issuer.bank.bic,
          }
        : { ...options.issuer.bank };
  }

  const corrected = textOf(
    child(
      children(
        child(root, "OriginalDocumentReferences"),
        "OriginalDocumentReference",
      )[0],
      "ID",
    ),
  );

  const noteNode = child(root, "Note");
  const note = textOf(noteNode) || undefined;
  const languageParsed = InvoiceLanguageSchema.safeParse(
    attrOf(noteNode, "languageID"),
  );
  const language: InvoiceLanguage = languageParsed.success
    ? languageParsed.data
    : "cs";

  const firstLineTax = child(
    children(child(root, "InvoiceLines"), "InvoiceLine")[0],
    "ClassifiedTaxCategory",
  );
  const reverseCode = textOf(
    child(child(firstLineTax, "LocalReverseCharge"), "LocalReverseChargeCode"),
  );

  const currencyRaw = textOf(child(root, "LocalCurrencyCode"));
  const currencyParsed = InvoiceCurrencySchema.safeParse(currencyRaw);
  const currency: InvoiceCurrency = currencyParsed.success
    ? currencyParsed.data
    : "CZK";

  const draft: Invoice = {
    meta: {
      docType,
      number,
      issueDate,
      dueDate: dueDate || issueDate,
      duzp: duzp || issueDate,
      language,
      currency,
      correctedInvoiceNumber:
        docType === "credit_note" ? corrected || number : undefined,
    },
    issuer: options.issuer,
    client,
    vat: {
      mode: reverseCode ? "reverse_charge" : "regular",
      suppliesAbroad: "none",
      localReverseChargeCode: reverseCode || undefined,
      legalNote: note,
    },
    payment,
    items,
    totals: {
      subtotal,
      vatBreakdown,
      vatTotal,
      total,
    },
    notes: note,
  };

  const parsed = InvoiceSchema.safeParse(draft);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`isdoc_schema_invalid: ${msg}`);
  }

  return {
    invoice: parsed.data,
    isdocUuid,
    softwareName,
    supplierIco,
  };
}

export type ParsedIssuerFromIsdoc = {
  name: string;
  ico?: string;
  dic?: string;
  street: string;
  city: string;
  zip: string;
  contactEmail?: string;
  vatPayer: boolean;
  accountNumber?: string;
  iban?: string;
  bic?: string;
};

/**
 * Extract supplier identity + bank from ISDOC AccountingSupplierParty.
 */
export function parseIssuerFromIsdoc(xml: string): ParsedIssuerFromIsdoc {
  const converted = convert(xml, { format: "object" });
  const root = findInvoiceRoot(converted);
  if (!root) {
    throw new Error("isdoc_missing_invoice_root");
  }

  const supplierParty = child(child(root, "AccountingSupplierParty"), "Party");
  if (!supplierParty) {
    throw new Error("isdoc_missing_supplier");
  }

  const name = partyName(supplierParty);
  if (!name) {
    throw new Error("isdoc_missing_supplier_name");
  }

  const address = partyAddress(supplierParty);
  if (address.country !== "CZ") {
    throw new Error("isdoc_supplier_not_cz");
  }

  const ico = partyIco(supplierParty);
  const dicRaw = partyDic(supplierParty);
  const dic = dicRaw && /^CZ\d{8,10}$/.test(dicRaw) ? dicRaw : undefined;
  const contactEmail = partyEmail(supplierParty);
  const vatPayer = Boolean(dic);

  const paymentNode = children(child(root, "PaymentMeans"), "Payment")[0];
  const details = child(paymentNode, "Details");
  const accountNumberRaw = formatAccount(
    textOf(child(details, "ID")),
    textOf(child(details, "BankCode")),
  );
  const ibanRaw = textOf(child(details, "IBAN"))
    .replace(/\s+/gu, "")
    .toUpperCase();
  const bic = textOf(child(details, "BIC")) || undefined;

  const accountNumber = accountNumberRaw || undefined;
  let iban = /^CZ\d{22}$/.test(ibanRaw) ? ibanRaw : undefined;

  if (accountNumber && !iban) {
    try {
      iban = czechAccountToIban(accountNumber);
    } catch {
      /** invalid account → leave IBAN empty */
    }
  }

  return {
    name,
    ico,
    dic,
    street: address.street,
    city: address.city,
    zip: address.zip,
    contactEmail,
    vatPayer,
    accountNumber,
    iban,
    bic,
  };
}

export type IncomingDocType =
  "invoice" | "credit_note" | "proforma" | "advance";

export type IncomingInvoiceLine = {
  position: number;
  description: string;
  quantity: string;
  unit?: string;
  unitPriceWithoutVat?: string;
  vatRate?: string;
  lineSubtotal?: string;
  lineVat?: string;
  lineTotal?: string;
};

export type ParsedIncomingIsdoc = {
  supplier: {
    ico?: string;
    dic?: string;
    name: string;
    address: { street: string; city: string; zip: string; country: string };
  };
  customer: { ico?: string; dic?: string; name: string };
  header: {
    number: string;
    docType: IncomingDocType;
    issueDate: string;
    taxDate?: string;
    dueDate: string;
    currency: string;
    subtotal: string;
    vatTotal: string;
    total: string;
    variableSymbol?: string;
    constantSymbol?: string;
    specificSymbol?: string;
    paymentMethod: "transfer" | "card" | "cash" | "direct_debit" | "other";
    messageForRecipient?: string;
  };
  payment: {
    iban?: string;
    accountNumber?: string;
    bankCode?: string;
    bic?: string;
  };
  vatBreakdown: Array<{ rate: string; base: string; vat: string }>;
  lines: IncomingInvoiceLine[];
  isdocUuid?: string;
};

function money2(n: number): string {
  return n.toFixed(2);
}

function money4(n: number): string {
  return n.toFixed(4);
}

/**
 * Parse ISDOC as a supplier invoice addressed to us (inverted party mapping).
 */
export function parseIsdocAsIncoming(xml: string): ParsedIncomingIsdoc {
  const converted = convert(xml, { format: "object" });
  const root = findInvoiceRoot(converted);
  if (!root) {
    throw new Error("isdoc_missing_invoice_root");
  }

  const number = textOf(child(root, "ID"));
  if (!number) {
    throw new Error("isdoc_missing_number");
  }

  const docType = docTypeFromIsdoc(textOf(child(root, "DocumentType")));
  const issueDate = textOf(child(root, "IssueDate"));
  const taxDate = textOf(child(root, "TaxPointDate")) || undefined;
  const isdocUuid = textOf(child(root, "UUID")) || undefined;

  const supplierParty = child(child(root, "AccountingSupplierParty"), "Party");
  const customerParty = child(child(root, "AccountingCustomerParty"), "Party");
  const supplierName = partyName(supplierParty);
  if (!supplierName) {
    throw new Error("isdoc_missing_supplier_name");
  }

  const lineNodes = children(child(root, "InvoiceLines"), "InvoiceLine");
  const lines: IncomingInvoiceLine[] = lineNodes.map((line, index) => {
    const qty = numOf(child(line, "InvoicedQuantity"), 1);
    const unitCode =
      asRecord(child(line, "InvoicedQuantity"))?.["@unitCode"] != null
        ? String(asRecord(child(line, "InvoicedQuantity"))!["@unitCode"])
        : "C62";
    const vatRate = Math.round(
      numOf(child(child(line, "ClassifiedTaxCategory"), "Percent"), 0),
    );
    const lineSubtotal = numOf(child(line, "LineExtensionAmount"));
    const lineVat = numOf(child(line, "LineExtensionTaxAmount"));
    const lineTotal = numOf(
      child(line, "LineExtensionAmountTaxInclusive"),
      lineSubtotal + lineVat,
    );
    const unitPrice = numOf(
      child(line, "UnitPrice"),
      qty !== 0 ? lineSubtotal / qty : 0,
    );
    return {
      position: Number(textOf(child(line, "ID"))) || index + 1,
      description:
        textOf(child(child(line, "Item"), "Description")) ||
        `Položka ${index + 1}`,
      quantity: money4(qty || 1),
      unit: unitFromCode(unitCode),
      unitPriceWithoutVat: money4(unitPrice),
      vatRate: String(vatRate),
      lineSubtotal: money2(lineSubtotal),
      lineVat: money2(lineVat),
      lineTotal: money2(lineTotal),
    };
  });

  const vatBreakdownMap = new Map<number, { base: number; vat: number }>();
  for (const st of children(child(root, "TaxTotal"), "TaxSubTotal")) {
    const rate = Math.round(
      numOf(child(child(st, "TaxCategory"), "Percent"), 0),
    );
    const base = numOf(child(st, "TaxableAmount"));
    const vat = numOf(child(st, "TaxAmount"));
    const prev = vatBreakdownMap.get(rate) ?? { base: 0, vat: 0 };
    vatBreakdownMap.set(rate, { base: prev.base + base, vat: prev.vat + vat });
  }
  let vatBreakdown = [...vatBreakdownMap.entries()].map(([rate, v]) => ({
    rate: String(rate),
    base: money2(v.base),
    vat: money2(v.vat),
  }));
  if (vatBreakdown.length === 0 && lines.length > 0) {
    const byRate = new Map<number, { base: number; vat: number }>();
    for (const line of lines) {
      const rate = Number(line.vatRate ?? 0);
      const prev = byRate.get(rate) ?? { base: 0, vat: 0 };
      byRate.set(rate, {
        base: prev.base + Number(line.lineSubtotal ?? 0),
        vat: prev.vat + Number(line.lineVat ?? 0),
      });
    }
    vatBreakdown = [...byRate.entries()].map(([rate, v]) => ({
      rate: String(rate),
      base: money2(v.base),
      vat: money2(v.vat),
    }));
  }

  const subtotal = numOf(
    child(child(root, "LegalMonetaryTotal"), "TaxExclusiveAmount"),
    lines.reduce((s, l) => s + Number(l.lineSubtotal ?? 0), 0),
  );
  let total = numOf(
    child(child(root, "LegalMonetaryTotal"), "PayableAmount"),
    lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0),
  );
  const vatTotal = numOf(
    child(child(root, "TaxTotal"), "TaxAmount"),
    lines.reduce((s, l) => s + Number(l.lineVat ?? 0), 0),
  );
  if (docType === "credit_note" && total > 0) {
    total = -total;
  }

  const paymentNode = children(child(root, "PaymentMeans"), "Payment")[0];
  const meansCode = textOf(child(paymentNode, "PaymentMeansCode")) || "42";
  const details = child(paymentNode, "Details");
  const dueDate =
    textOf(child(details, "PaymentDueDate")) ||
    textOf(child(root, "PaymentDueDate")) ||
    issueDate;
  const accountNumber = textOf(child(details, "ID")) || undefined;
  const bankCode = textOf(child(details, "BankCode")) || undefined;
  const ibanRaw = textOf(child(details, "IBAN"))
    .replace(/\s+/gu, "")
    .toUpperCase();
  const iban = ibanRaw || undefined;
  const bic = textOf(child(details, "BIC")) || undefined;
  const method = paymentMethodFromCode(meansCode);
  const incomingMethod =
    method === "cash" || method === "card" || method === "transfer"
      ? method
      : "other";

  const currencyRaw = textOf(child(root, "LocalCurrencyCode")) || "CZK";

  return {
    supplier: {
      ico: partyIco(supplierParty),
      dic: partyDic(supplierParty),
      name: supplierName,
      address: partyAddress(supplierParty),
    },
    customer: {
      ico: partyIco(customerParty),
      dic: partyDic(customerParty),
      name: partyName(customerParty),
    },
    header: {
      number,
      docType,
      issueDate,
      taxDate,
      dueDate: dueDate || issueDate,
      currency: currencyRaw.toUpperCase() || "CZK",
      subtotal: money2(
        docType === "credit_note" && subtotal > 0 ? -subtotal : subtotal,
      ),
      vatTotal: money2(
        docType === "credit_note" && vatTotal > 0 ? -vatTotal : vatTotal,
      ),
      total: money2(total),
      variableSymbol: textOf(child(details, "VariableSymbol")) || undefined,
      constantSymbol: textOf(child(details, "ConstantSymbol")) || undefined,
      specificSymbol: textOf(child(details, "SpecificSymbol")) || undefined,
      paymentMethod: incomingMethod,
      messageForRecipient: textOf(child(root, "Note")) || undefined,
    },
    payment: {
      iban,
      accountNumber,
      bankCode,
      bic,
    },
    vatBreakdown: vatBreakdown.map((row) =>
      docType === "credit_note"
        ? {
            rate: row.rate,
            base: money2(-Math.abs(Number(row.base))),
            vat: money2(-Math.abs(Number(row.vat))),
          }
        : row,
    ),
    lines:
      docType === "credit_note"
        ? lines.map((line) => ({
            ...line,
            lineSubtotal: line.lineSubtotal
              ? money2(-Math.abs(Number(line.lineSubtotal)))
              : line.lineSubtotal,
            lineVat: line.lineVat
              ? money2(-Math.abs(Number(line.lineVat)))
              : line.lineVat,
            lineTotal: line.lineTotal
              ? money2(-Math.abs(Number(line.lineTotal)))
              : line.lineTotal,
          }))
        : lines,
    isdocUuid,
  };
}
