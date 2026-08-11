/**
 * ISDOC 6.0.2 XML (`specs/isdoc.md`).
 * xmbuilder chains are loosely typed (`Xm`).
 */

import type { Invoice } from "../schema";
import { stripInlineMarkdown } from "../pdf/inline-markdown";
import { create } from "xmlbuilder2";
import { v5 as uuidv5 } from "uuid";

export const ISDOC_XML_NAMESPACE = "http://isdoc.cz/namespace/2013" as const;

const NSDOC = ISDOC_XML_NAMESPACE;

type Xm = any;

const UUID_NAMESPACE = uuidv5("invoicey.isdoc_invoice.v1", uuidv5.DNS);

function countryName(alpha2: string): string {
  const labels: Record<string, string> = {
    CZ: "Česká republika",
    SK: "Slovensko",
    DE: "Německo",
    PL: "Polsko",
    AT: "Rakousko",
    GB: "Spojené království",
    US: "Spojené státy",
    FR: "Francie",
  };
  return labels[alpha2] ?? alpha2;
}

function postalZone(zip: string): string {
  return zip.replaceAll(/\s+/g, "").trim();
}

function money(amount: number): string {
  if (Object.is(amount, -0)) {
    return "0.00";
  }
  return amount.toFixed(2);
}

function documentType(inv: Invoice): string {
  switch (inv.meta.docType) {
    case "invoice":
      return "1";
    case "credit_note":
      return "2";
    case "proforma":
      return "4";
    case "advance":
      return "5";
    default: {
      const _n: never = inv.meta.docType;
      return _n;
    }
  }
}

function isoBoolean(v: boolean): "true" | "false" {
  return v ? "true" : "false";
}

export function stableIsdocInvoiceUuid(inv: Invoice): string {
  return uuidv5(
    `${inv.issuer.id}|${inv.meta.number}|${inv.meta.issueDate}`,
    UUID_NAMESPACE,
  );
}

export function parseCzAccountNumber(canonical: string): {
  number: string;
  bankCode: string;
} {
  const m = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/u.exec(canonical.trim());
  if (!m) {
    throw new Error(`invalid Czech account number: ${canonical}`);
  }
  const prefix = m[1];
  const num = m[2]!;
  const code = m[3]!;
  const number = prefix ? `${prefix}-${num}` : num;
  return { number, bankCode: code };
}

function unitInclusive(item: Invoice["items"][0]): number {
  if (Math.abs(item.quantity) < 1e-9) {
    return 0;
  }
  return Number((item.lineTotal / item.quantity).toFixed(6));
}

function headerNote(inv: Invoice): string {
  const parts: string[] = [];
  if (inv.vat.legalNote?.trim()) {
    parts.push(inv.vat.legalNote.trim());
  }
  if (inv.payment.instructionsBefore?.trim()) {
    parts.push(stripInlineMarkdown(inv.payment.instructionsBefore.trim()));
  }
  if (inv.payment.instructionsAfter?.trim()) {
    parts.push(stripInlineMarkdown(inv.payment.instructionsAfter.trim()));
  }
  if (inv.notes?.trim()) {
    parts.push(inv.notes.trim());
  }
  if (
    inv.meta.docType === "credit_note" &&
    inv.meta.correctedInvoiceNumber?.trim()
  ) {
    parts.push(`Opravuje doklad č. ${inv.meta.correctedInvoiceNumber.trim()}`);
  }
  return parts.join("\n").trim();
}

function isReverseCharge(inv: Invoice): boolean {
  return inv.vat.mode === "reverse_charge";
}

function isOss(inv: Invoice): boolean {
  return inv.vat.mode === "oss";
}

function appendPostalAddress(
  el: Xm,
  street: string,
  city: string,
  zip: string,
  countryAlpha2: string,
) {
  const cc = countryAlpha2.trim().toUpperCase();

  el.ele(NSDOC, "StreetName").txt(street.trim()).up();
  el.ele(NSDOC, "BuildingNumber").txt("").up();
  el.ele(NSDOC, "CityName").txt(city.trim()).up();
  el.ele(NSDOC, "PostalZone").txt(postalZone(zip)).up();
  const cn = el.ele(NSDOC, "Country");
  cn.ele(NSDOC, "IdentificationCode").txt(cc).up();
  cn.ele(NSDOC, "Name").txt(countryName(cc)).up();
  cn.up();
}

function appendAccountingSupplierParty(root: Xm, invoice: Invoice) {
  const asp = root.ele(NSDOC, "AccountingSupplierParty");
  const party = asp.ele(NSDOC, "Party");

  const pid = party.ele(NSDOC, "PartyIdentification");
  pid.ele(NSDOC, "ID").txt(invoice.issuer.ico).up();
  pid.up();

  party
    .ele(NSDOC, "PartyName")
    .ele(NSDOC, "Name")
    .txt(invoice.issuer.name)
    .up()
    .up();

  const addr = party.ele(NSDOC, "PostalAddress");
  appendPostalAddress(
    addr,
    invoice.issuer.address.street,
    invoice.issuer.address.city,
    invoice.issuer.address.zip,
    invoice.issuer.address.country,
  );
  addr.up();

  if (invoice.issuer.vatPayer && invoice.issuer.dic?.trim()) {
    const pts = party.ele(NSDOC, "PartyTaxScheme");
    pts.ele(NSDOC, "CompanyID").txt(invoice.issuer.dic.trim()).up();
    pts.ele(NSDOC, "TaxScheme").txt("VAT").up();
    pts.up();
  }

  if (invoice.issuer.registryNote?.trim()) {
    const pref = party.ele(NSDOC, "RegisterIdentification");
    pref
      .ele(NSDOC, "Preformatted")
      .txt(invoice.issuer.registryNote.trim())
      .up();
    pref.up();
  }

  const contactEl = party.ele(NSDOC, "Contact");
  contactEl.ele(NSDOC, "ElectronicMail").txt(invoice.issuer.contactEmail).up();
  contactEl.up();

  party.up();
  asp.up();
}

function appendAccountingCustomerParty(root: Xm, invoice: Invoice) {
  const acp = root.ele(NSDOC, "AccountingCustomerParty");
  const party = acp.ele(NSDOC, "Party");

  const pid = party.ele(NSDOC, "PartyIdentification");
  pid
    .ele(NSDOC, "ID")
    .txt(invoice.client.ico?.trim() ?? "")
    .up();
  pid.up();

  party
    .ele(NSDOC, "PartyName")
    .ele(NSDOC, "Name")
    .txt(invoice.client.name)
    .up()
    .up();

  const addr = party.ele(NSDOC, "PostalAddress");
  appendPostalAddress(
    addr,
    invoice.client.address.street,
    invoice.client.address.city,
    invoice.client.address.zip,
    invoice.client.address.country,
  );
  addr.up();

  if (invoice.client.dic?.trim()) {
    const pts = party.ele(NSDOC, "PartyTaxScheme");
    pts.ele(NSDOC, "CompanyID").txt(invoice.client.dic.trim()).up();
    pts.ele(NSDOC, "TaxScheme").txt("VAT").up();
    pts.up();
  }

  party.up();
  acp.up();
}

function appendOriginalDocumentRefs(root: Xm, invoice: Invoice) {
  const ref = invoice.meta.correctedInvoiceNumber?.trim();
  if (invoice.meta.docType !== "credit_note" || !ref) {
    return;
  }
  const ors = root.ele(NSDOC, "OriginalDocumentReferences");
  ors
    .ele(NSDOC, "OriginalDocumentReference", { id: "orig-document" })
    .ele(NSDOC, "ID")
    .txt(ref)
    .up()
    .up();
  ors.up();
}

function appendClassifiedTaxCategory(
  bucket: Xm,
  invoice: Invoice,
  line: Invoice["items"][0],
) {
  const rateDisplay = isReverseCharge(invoice) ? 0 : line.vatRate;
  bucket.ele(NSDOC, "Percent").txt(String(rateDisplay)).up();

  bucket.ele(NSDOC, "VATCalculationMethod").txt("0").up();

  if (invoice.issuer.vatPayer || isReverseCharge(invoice) || isOss(invoice)) {
    bucket
      .ele(NSDOC, "VATApplicable")
      .txt(isoBoolean(invoice.issuer.vatPayer))
      .up();
  }

  if (isReverseCharge(invoice)) {
    const lrc = bucket.ele(NSDOC, "LocalReverseCharge");
    lrc
      .ele(NSDOC, "LocalReverseChargeCode")
      .txt(invoice.vat.localReverseChargeCode!.trim())
      .up();
    lrc.up();
  }
}

function appendInvoiceLines(root: Xm, invoice: Invoice) {
  const ils = root.ele(NSDOC, "InvoiceLines");
  const sorted = [...invoice.items].sort((a, b) => a.position - b.position);
  for (const line of sorted) {
    const li = ils.ele(NSDOC, "InvoiceLine");
    li.ele(NSDOC, "ID").txt(String(line.position)).up();

    const qty = String(line.quantity);
    li.ele(NSDOC, "InvoicedQuantity", {
      unitCode: unitCodeForInvoiceUnit(line.unit),
    })
      .txt(qty)
      .up();

    li.ele(NSDOC, "LineExtensionAmount").txt(money(line.lineSubtotal)).up();
    li.ele(NSDOC, "LineExtensionAmountTaxInclusive")
      .txt(money(line.lineTotal))
      .up();
    li.ele(NSDOC, "LineExtensionTaxAmount").txt(money(line.lineVat)).up();

    li.ele(NSDOC, "UnitPrice").txt(money(line.unitPriceWithoutVat)).up();
    li.ele(NSDOC, "UnitPriceTaxInclusive")
      .txt(money(unitInclusive(line)))
      .up();

    const classifiedBucket = li.ele(NSDOC, "ClassifiedTaxCategory");
    appendClassifiedTaxCategory(classifiedBucket, invoice, line);
    classifiedBucket.up();

    if (invoice.vat.legalNote?.trim() && isReverseCharge(invoice)) {
      li.ele(NSDOC, "VATNote").txt(invoice.vat.legalNote.trim()).up();
    }

    const itemEl = li.ele(NSDOC, "Item");
    itemEl.ele(NSDOC, "Description").txt(line.description).up();
    itemEl.up();

    li.up();
  }
  ils.up();
}

function unitCodeForInvoiceUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === "h" || u === "hod" || u === "hod.") {
    return "HUR";
  }
  return "C62";
}

function appendTaxTotal(root: Xm, invoice: Invoice) {
  const zero = money(0);
  const tt = root.ele(NSDOC, "TaxTotal");

  for (const row of invoice.totals.vatBreakdown) {
    const st = tt.ele(NSDOC, "TaxSubTotal");

    st.ele(NSDOC, "TaxableAmount").txt(money(row.base)).up();
    st.ele(NSDOC, "TaxAmount").txt(money(row.vat)).up();
    st.ele(NSDOC, "TaxInclusiveAmount")
      .txt(money(row.base + row.vat))
      .up();

    st.ele(NSDOC, "AlreadyClaimedTaxableAmount").txt(zero).up();
    st.ele(NSDOC, "AlreadyClaimedTaxAmount").txt(zero).up();
    st.ele(NSDOC, "AlreadyClaimedTaxInclusiveAmount").txt(zero).up();

    st.ele(NSDOC, "DifferenceTaxableAmount").txt(money(row.base)).up();
    st.ele(NSDOC, "DifferenceTaxAmount").txt(money(row.vat)).up();
    st.ele(NSDOC, "DifferenceTaxInclusiveAmount")
      .txt(money(row.base + row.vat))
      .up();

    const tc = st.ele(NSDOC, "TaxCategory");
    tc.ele(NSDOC, "Percent")
      .txt(String(isReverseCharge(invoice) ? 0 : row.rate))
      .up();
    tc.ele(NSDOC, "TaxScheme").txt("VAT").up();
    if (isReverseCharge(invoice)) {
      tc.ele(NSDOC, "LocalReverseChargeFlag").txt("true").up();
    }
    tc.up();

    st.up();
  }

  tt.ele(NSDOC, "TaxAmount").txt(money(invoice.totals.vatTotal)).up();

  tt.up();
}

function appendLegalMonetaryTotal(root: Xm, invoice: Invoice) {
  const z = money(0);
  const sub = money(invoice.totals.subtotal);
  const total = money(invoice.totals.total);
  const lmt = root.ele(NSDOC, "LegalMonetaryTotal");

  lmt.ele(NSDOC, "TaxExclusiveAmount").txt(sub).up();
  lmt.ele(NSDOC, "TaxInclusiveAmount").txt(total).up();

  lmt.ele(NSDOC, "AlreadyClaimedTaxExclusiveAmount").txt(z).up();
  lmt.ele(NSDOC, "AlreadyClaimedTaxInclusiveAmount").txt(z).up();

  lmt.ele(NSDOC, "DifferenceTaxExclusiveAmount").txt(sub).up();
  lmt.ele(NSDOC, "DifferenceTaxInclusiveAmount").txt(total).up();

  lmt.ele(NSDOC, "PaidDepositsAmount").txt(z).up();
  lmt.ele(NSDOC, "PayableAmount").txt(total).up();

  lmt.up();
}

function paymentMeansInteger(invoice: Invoice): number {
  switch (invoice.payment.method) {
    case "transfer":
      return 42;
    case "cash":
      return 10;
    case "card":
      return 48;
    default: {
      const _n: never = invoice.payment.method;
      return _n;
    }
  }
}

function appendPaymentMeans(root: Xm, invoice: Invoice) {
  const pm = root.ele(NSDOC, "PaymentMeans");

  const pays = pm.ele(NSDOC, "Payment", { partialPayment: "false" });
  pays.ele(NSDOC, "PaidAmount").txt(money(invoice.totals.total)).up();
  pays
    .ele(NSDOC, "PaymentMeansCode")
    .txt(String(paymentMeansInteger(invoice)))
    .up();

  const details = pays.ele(NSDOC, "Details");

  if (invoice.payment.method === "transfer" && invoice.payment.bankAccount) {
    const accParsed = parseCzAccountNumber(
      invoice.payment.bankAccount.accountNumber,
    );
    details.ele(NSDOC, "PaymentDueDate").txt(invoice.meta.dueDate).up();
    details.ele(NSDOC, "ID").txt(accParsed.number).up();
    details.ele(NSDOC, "BankCode").txt(accParsed.bankCode).up();
    details.ele(NSDOC, "Name").txt(invoice.issuer.name).up();
    details.ele(NSDOC, "IBAN").txt(invoice.payment.bankAccount.iban).up();
    details
      .ele(NSDOC, "BIC")
      .txt(invoice.payment.bankAccount.bic?.trim() ?? "")
      .up();

    if (invoice.payment.variableSymbol?.trim()) {
      details
        .ele(NSDOC, "VariableSymbol")
        .txt(invoice.payment.variableSymbol.trim())
        .up();
    }
    if (invoice.payment.constantSymbol?.trim()) {
      details
        .ele(NSDOC, "ConstantSymbol")
        .txt(invoice.payment.constantSymbol.trim())
        .up();
    }
    if (invoice.payment.specificSymbol?.trim()) {
      details
        .ele(NSDOC, "SpecificSymbol")
        .txt(invoice.payment.specificSymbol.trim())
        .up();
    }
  } else {
    details.ele(NSDOC, "DocumentID").txt(`${invoice.payment.method}-stub`).up();
    details.ele(NSDOC, "IssueDate").txt(invoice.meta.issueDate).up();
  }

  details.up();
  pays.up();
  pm.up();
}

/** Serializes a validated Czech invoice snapshot into ISDOC 6.0.2 XML. */
export function renderIsdoc(invoice: Invoice): string {
  const xml = create({ encoding: "UTF-8", standalone: false });

  const invoiceEl = xml.ele(NSDOC, "Invoice", { version: "6.0.2" });

  invoiceEl.ele(NSDOC, "DocumentType").txt(documentType(invoice)).up();

  invoiceEl.ele(NSDOC, "ID").txt(invoice.meta.number).up();
  invoiceEl.ele(NSDOC, "UUID").txt(stableIsdocInvoiceUuid(invoice)).up();

  invoiceEl.ele(NSDOC, "IssueDate").txt(invoice.meta.issueDate).up();

  if (invoice.meta.docType !== "proforma") {
    invoiceEl.ele(NSDOC, "TaxPointDate").txt(invoice.meta.duzp).up();
  }

  invoiceEl
    .ele(NSDOC, "VATApplicable")
    .txt(isoBoolean(invoice.issuer.vatPayer))
    .up();

  invoiceEl.ele(NSDOC, "ElectronicPossibilityAgreementReference").txt("").up();

  const combinedNote = headerNote(invoice);
  if (combinedNote.length > 0) {
    invoiceEl.ele(NSDOC, "Note").txt(combinedNote).up();
  }

  invoiceEl.ele(NSDOC, "LocalCurrencyCode").txt(invoice.meta.currency).up();
  invoiceEl.ele(NSDOC, "CurrRate").txt("1").up();
  invoiceEl.ele(NSDOC, "RefCurrRate").txt("1").up();

  appendAccountingSupplierParty(invoiceEl, invoice);
  appendAccountingCustomerParty(invoiceEl, invoice);
  appendOriginalDocumentRefs(invoiceEl, invoice);
  appendInvoiceLines(invoiceEl, invoice);
  appendTaxTotal(invoiceEl, invoice);
  appendLegalMonetaryTotal(invoiceEl, invoice);
  appendPaymentMeans(invoiceEl, invoice);

  invoiceEl.up();

  return xml.end({
    headless: false,
    prettyPrint: false,
    newline: "\n",
  });
}
