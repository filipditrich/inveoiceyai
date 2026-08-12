/** @jsxImportSource react */
import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import React from "react";

import type { Invoice, InvoiceCurrency, InvoiceItem } from "../schema";
import { currencyDisplaySuffix } from "../schema";
import {
  invoiceLabels,
  toInvoiceIntlLocale,
  type InvoiceLabels,
} from "../labels";
import { parseInlineMarkdown } from "./inline-markdown";

const INVOICEY_SITE_URL = "https://ditrich.me/";

const F_SANS = "Inter";

const BODY = "#0a0a0a";
const MUTED = "#4b5563";
const LINE = "#e5e7eb";

type InvoiceVatBreakdownRowModel = Invoice["totals"]["vatBreakdown"][number];

export interface InvoicePdfAssets {
  readonly qrDataUrl?: string | null;
  readonly logo?: Buffer;
  readonly stamp?: Buffer;
  readonly signature?: Buffer;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    fontFamily: F_SANS,
    fontSize: 8.5,
    paddingTop: 32,
    paddingHorizontal: 42,
    paddingBottom: 52,
    color: BODY,
  },
  mainColumn: {
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
  },
  /** Full header + parties, hairline before table body */
  upperSheet: {
    width: "100%",
    paddingBottom: 14,
    borderBottomWidth: 0,
    borderBottomColor: LINE,
    marginBottom: 10,
  },
  upperTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  upperTopCol: {
    width: "48%",
  },
  heroMin: {
    width: "100%",
    minHeight: 78,
    justifyContent: "flex-start",
  },
  logoImg: {
    maxHeight: 52,
    width: 140,
    objectFit: "contain",
    objectPosition: "left top",
  },
  /** Thin rule over title column (Pokojovky ref) */
  titleColRule: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    marginBottom: 8,
  },
  invoiceTitle: {
    fontFamily: F_SANS,
    fontSize: 15,
    fontWeight: 700,
    color: BODY,
    lineHeight: 1.08,
  },
  docKindMicro: {
    fontFamily: F_SANS,
    fontSize: 6.75,
    fontWeight: 400,
    color: MUTED,
    marginTop: 4,
  },
  partyPairRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  partyCol: {
    width: "48%",
    alignItems: "stretch",
  },
  sectionHairShort: {
    width: 44,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    marginBottom: 6,
  },
  sectionCaps: {
    fontFamily: F_SANS,
    fontSize: 6.5,
    fontWeight: 400,
    color: MUTED,
    marginBottom: 4,
  },
  partyName: {
    fontFamily: F_SANS,
    fontSize: 10,
    fontWeight: 700,
    color: BODY,
    marginBottom: 3,
  },
  partyAddr: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: MUTED,
    lineHeight: 1.3,
  },
  partyAddrTight: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: MUTED,
    lineHeight: 1.3,
    marginTop: 1,
  },
  kvRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 3,
    width: "100%",
  },
  kvRowFirst: { marginTop: 0 },
  kvKeyCol: {
    width: "44%",
    paddingRight: 6,
  },
  kvKey: {
    fontFamily: F_SANS,
    fontSize: 7.5,
    fontWeight: 400,
    color: MUTED,
  },
  kvValCol: {
    width: "56%",
  },
  paymentKvKeyCol: {
    width: "32%",
    paddingRight: 8,
  },
  paymentKvValCol: {
    width: "68%",
  },
  kvVal: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: BODY,
    textAlign: "right",
  },
  kvBlock: { width: "100%", marginTop: 6 },
  kvBlockGap: { width: "100%", marginTop: 8 },
  paymentDetailKv: { marginTop: 0, width: "100%", alignSelf: "stretch" },
  tableWrap: { marginTop: 4 },
  tableHeadRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingBottom: 4,
    paddingTop: 2,
  },
  th: {
    fontFamily: F_SANS,
    fontSize: 6.5,
    fontWeight: 400,
    color: MUTED,
  },
  thDesc: { width: "30%" },
  thQty: { width: "9%", textAlign: "right", paddingRight: 4 },
  thUnit: { width: "8%" },
  thUnitPx: { width: "16%", textAlign: "right" },
  thVat: { width: "12%", textAlign: "right", paddingRight: 4 },
  thTot: { width: "25%", textAlign: "right" },
  lineRow: {
    flexDirection: "row",
    paddingVertical: 6,
    alignItems: "flex-start",
  },
  tableRowsRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  descCol: { width: "30%", paddingRight: 6 },
  lineSub: {
    fontFamily: F_SANS,
    fontSize: 7.75,
    fontWeight: 400,
    color: MUTED,
    marginTop: 1,
    lineHeight: 1.28,
  },
  cellRight: { textAlign: "right" as const },
  cellFig: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: BODY,
  },
  cellFigStrong: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 700,
    color: BODY,
  },
  totalsBlock: {
    marginTop: 10,
    alignSelf: "flex-end",
    width: 260,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalLbl: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: MUTED,
  },
  totalFig: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: BODY,
    textAlign: "right",
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  /** Neplátce: no VAT sub-rows — avoid double rule with table bottom */
  totalGrandNoVatIssuer: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 8,
  },
  totalGrandLbl: {
    fontFamily: F_SANS,
    fontSize: 8.5,
    fontWeight: 700,
    color: BODY,
  },
  totalGrandFig: {
    fontFamily: F_SANS,
    fontSize: 15,
    fontWeight: 700,
    color: BODY,
    lineHeight: 1.05,
  },
  legalMini: {
    fontFamily: F_SANS,
    fontWeight: 400,
    marginTop: 6,
    fontSize: 7.75,
    lineHeight: 1.33,
    color: MUTED,
  },
  asideTitle: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 700,
    color: BODY,
  },
  paymentOuter: {
    width: "100%",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  paymentOuterAfterInstructions: {
    marginTop: 0,
    borderTopWidth: 0,
  },
  /** Fixed column + flex sibling with flexBasis:0 prevents QR/text overlap under Yoga */
  paymentQrCol: {
    width: 104,
    height: 104,
    flexShrink: 0,
    flexGrow: 0,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  paymentNoteCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: "100%",
  },
  paymentNoteColPadQr: {
    paddingLeft: 6,
  },
  paymentHint: {
    fontFamily: F_SANS,
    fontSize: 7.5,
    fontWeight: 400,
    color: MUTED,
    marginTop: 8,
    lineHeight: 1.4,
  },
  paymentInstructions: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: BODY,
    lineHeight: 1.4,
  },
  paymentInstructionsBefore: {
    marginTop: 14,
    marginBottom: 8,
  },
  paymentInstructionsAfter: {
    marginTop: 10,
  },
  paySectionHeading: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 700,
    color: BODY,
    marginBottom: 6,
  },
  payMethodTxt: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 400,
    color: MUTED,
    marginTop: 2,
  },
  qr: { width: 96, height: 96, flexShrink: 0 },
  footerRow: {
    position: "absolute",
    bottom: 28,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    borderTopWidth: 0,
    borderTopColor: LINE,
    paddingTop: 7,
  },
  footerBrand: {
    fontFamily: F_SANS,
    fontSize: 7,
    color: MUTED,
    textAlign: "right",
    textDecoration: "none",
  },
  footerBrandStrong: {
    fontWeight: 700,
    color: BODY,
    textDecoration: "none",
  },
  stampSigRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  stampSigBox: { marginLeft: 16 },
  stampSig: {
    width: 120,
    height: 48,
    objectFit: "contain",
    objectPosition: "bottom",
  },
  creditInline: {
    fontFamily: F_SANS,
    fontSize: 8,
    fontWeight: 700,
    color: BODY,
  },
});

function fmtMoneyAmount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtMoneyWithCurrency(
  n: number,
  currency: InvoiceCurrency,
  locale: string,
): string {
  return `${fmtMoneyAmount(n, locale)}\u00a0${currencyDisplaySuffix(currency)}`;
}

function fmtDateIsoLocal(dateIso: string, locale: string): string {
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) {
    return dateIso;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function fmtQty(n: number, locale: string): string {
  const s = n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return s.replaceAll(",", " ");
}

function formatIbanDisplay(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join("\u00a0");
}

function paymentMethodLabel(
  method: Invoice["payment"]["method"],
  labels: InvoiceLabels,
): string {
  switch (method) {
    case "transfer":
      return labels.payTransfer;
    case "cash":
      return labels.payCashShort;
    case "card":
      return labels.payCardShort;
    default: {
      const _never: never = method;
      return _never;
    }
  }
}

function countryHuman(code: string, labels: InvoiceLabels): string {
  return code === "CZ" ? labels.countryCz : code;
}

function docKindUpper(inv: Invoice, labels: InvoiceLabels): string {
  switch (inv.meta.docType) {
    case "invoice":
      return labels.docKindInvoice;
    case "credit_note":
      return labels.docKindCreditNote;
    case "proforma":
      return labels.docKindProforma;
    case "advance":
      return labels.docKindAdvance;
    default: {
      const _never: never = inv.meta.docType;
      return _never;
    }
  }
}

function invoicePdfMainTitle(inv: Invoice, labels: InvoiceLabels): string {
  switch (inv.meta.docType) {
    case "invoice":
      return `${labels.titleInvoice} ${inv.meta.number}`;
    case "credit_note":
      return `${labels.titleCreditNote} ${inv.meta.number}`;
    case "proforma":
      return `${labels.titleProforma} ${inv.meta.number}`;
    case "advance":
      return `${labels.titleAdvance} ${inv.meta.number}`;
    default: {
      const _never: never = inv.meta.docType;
      return _never;
    }
  }
}

function splitDescription(raw: string): { title: string; detail?: string } {
  const idx = raw.indexOf("\n");
  if (idx === -1) {
    return { title: raw };
  }
  const title = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + 1).trim();
  return { title: title.length > 0 ? title : raw, detail: rest || undefined };
}

function PdfKv({
  k,
  v,
  first,
}: Readonly<{
  k: string;
  v: string;
  first?: boolean;
}>) {
  const rs = first === true ? [styles.kvRow, styles.kvRowFirst] : styles.kvRow;
  return (
    <View style={rs}>
      <View style={styles.kvKeyCol}>
        <Text style={styles.kvKey}>{k}</Text>
      </View>
      <View style={styles.kvValCol}>
        <Text style={styles.kvVal}>{v}</Text>
      </View>
    </View>
  );
}

function PdfPaymentKv({
  k,
  v,
  first,
}: Readonly<{
  k: string;
  v: string;
  first?: boolean;
}>) {
  const rs = first === true ? [styles.kvRow, styles.kvRowFirst] : styles.kvRow;
  return (
    <View style={rs}>
      <View style={styles.paymentKvKeyCol}>
        <Text style={styles.kvKey}>{k}</Text>
      </View>
      <View style={styles.paymentKvValCol}>
        <Text style={styles.kvVal}>{v}</Text>
      </View>
    </View>
  );
}

function PdfMarkdownText({
  source,
}: Readonly<{
  source: string;
}>) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const spans = parseInlineMarkdown(line);
        return (
          <Text key={i} style={styles.paymentInstructions}>
            {spans.length === 0
              ? " "
              : spans.map((span, j) => (
                  <Text
                    key={j}
                    style={{
                      fontWeight: span.bold ? 700 : 400,
                      fontStyle: span.italic ? "italic" : "normal",
                    }}
                  >
                    {span.text}
                  </Text>
                ))}
          </Text>
        );
      })}
    </View>
  );
}

function PdfInvoiceLineRow({
  item,
  currency,
  locale,
}: Readonly<{
  item: InvoiceItem;
  currency: InvoiceCurrency;
  locale: string;
}>) {
  const { title, detail } = splitDescription(item.description);
  return (
    <View style={styles.lineRow}>
      <View style={styles.descCol}>
        <Text style={styles.cellFig}>{title}</Text>
        {detail ? <Text style={styles.lineSub}>{detail}</Text> : null}
      </View>
      <Text style={[styles.thQty, styles.cellFig, styles.cellRight]}>
        {fmtQty(item.quantity, locale)}
      </Text>
      <Text style={[styles.thUnit, styles.cellFig]}>{item.unit}</Text>
      <Text style={[styles.thUnitPx, styles.cellFig, styles.cellRight]}>
        {fmtMoneyWithCurrency(item.unitPriceWithoutVat, currency, locale)}
      </Text>
      <Text
        style={[styles.thVat, styles.cellFig, styles.cellRight]}
      >{`${String(item.vatRate)}\u00a0%`}</Text>
      <Text style={[styles.thTot, styles.cellFigStrong, styles.cellRight]}>
        {fmtMoneyWithCurrency(item.lineTotal, currency, locale)}
      </Text>
    </View>
  );
}

export interface InvoicePdfDocumentProps {
  readonly invoice: Invoice;
  readonly assets: InvoicePdfAssets;
}

export function InvoicePdfDocument({
  invoice: inv,
  assets,
}: InvoicePdfDocumentProps) {
  const labels = invoiceLabels(inv.meta.language);
  const intlLocale = toInvoiceIntlLocale(inv.meta.language);
  const showStamp = inv.customization?.showStamp === true;
  const showSignature = inv.customization?.showSignature === true;

  const showDuzp =
    inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";

  const showRecapDetail =
    inv.issuer.vatPayer &&
    inv.vat.mode === "regular" &&
    inv.totals.vatBreakdown.length > 0 &&
    inv.totals.vatTotal > 0;

  const sortedItems = [...inv.items].sort((a, b) => a.position - b.position);

  const issuerCountry = countryHuman(inv.issuer.address.country, labels);
  const clientCountry = countryHuman(inv.client.address.country, labels);

  const transfer = inv.payment.method === "transfer" && inv.payment.bankAccount;
  const hasQr = Boolean(assets.qrDataUrl);
  const instructionsBefore = inv.payment.instructionsBefore?.trim() || null;
  const instructionsAfter = inv.payment.instructionsAfter?.trim() || null;
  const showClientIdentifiers =
    Boolean(inv.client.ico) ||
    Boolean(inv.client.dic) ||
    Boolean(inv.client.contactEmail);

  return (
    <Document title={invoicePdfMainTitle(inv, labels)} creator="Invoicey">
      <Page size="A4" style={styles.page}>
        <View style={styles.mainColumn}>
          <View style={styles.upperSheet}>
            <View style={styles.upperTopRow}>
              <View style={styles.upperTopCol}>
                <View style={styles.heroMin}>
                  {assets.logo ? (
                    <Image style={styles.logoImg} src={assets.logo} />
                  ) : null}
                </View>
              </View>
              <View style={styles.upperTopCol}>
                <View style={styles.heroMin}>
                  <View style={styles.titleColRule} />
                  <Text style={styles.invoiceTitle}>
                    {invoicePdfMainTitle(inv, labels)}
                  </Text>
                  <Text style={styles.docKindMicro}>
                    {docKindUpper(inv, labels)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.partyPairRow}>
              <View style={styles.partyCol}>
                <View style={styles.sectionHairShort} />
                <Text style={styles.sectionCaps}>{labels.supplier}</Text>
                <Text style={styles.partyName}>{inv.issuer.name}</Text>
                <Text style={styles.partyAddr}>
                  {inv.issuer.address.street}
                </Text>
                <Text style={styles.partyAddrTight}>
                  {inv.issuer.address.zip}
                  {", "}
                  {inv.issuer.address.city}
                </Text>
                <Text style={styles.partyAddrTight}>{issuerCountry}</Text>
                <View style={styles.kvBlock}>
                  <PdfKv first k={labels.ico} v={inv.issuer.ico} />
                  {inv.issuer.vatPayer && inv.issuer.dic ? (
                    <PdfKv k={labels.dic} v={inv.issuer.dic} />
                  ) : null}
                  {!inv.issuer.vatPayer ? (
                    <PdfKv k={labels.vat} v={labels.nonVatPayer} />
                  ) : null}
                  <PdfKv k={labels.contactEmail} v={inv.issuer.contactEmail} />
                </View>
                {inv.issuer.registryNote ? (
                  <Text style={[styles.partyAddrTight, { marginTop: 6 }]}>
                    {inv.issuer.registryNote}
                  </Text>
                ) : null}
                <View style={styles.kvBlockGap}>
                  {transfer ? (
                    <PdfKv
                      first
                      k={labels.bankAccount}
                      v={transfer.accountNumber}
                    />
                  ) : null}
                  {transfer && inv.payment.variableSymbol ? (
                    <PdfKv
                      first={false}
                      k={labels.variableSymbol}
                      v={inv.payment.variableSymbol}
                    />
                  ) : null}
                  <PdfKv
                    first={!transfer}
                    k={labels.paymentMethod}
                    v={paymentMethodLabel(inv.payment.method, labels)}
                  />
                </View>
              </View>

              <View style={styles.partyCol}>
                <View style={styles.sectionHairShort} />
                <Text style={styles.sectionCaps}>{labels.customer}</Text>
                <Text style={styles.partyName}>{inv.client.name}</Text>
                <Text style={styles.partyAddr}>
                  {inv.client.address.street}
                </Text>
                <Text style={styles.partyAddrTight}>
                  {inv.client.address.zip}
                  {", "}
                  {inv.client.address.city}
                </Text>
                <Text style={styles.partyAddrTight}>{clientCountry}</Text>
                {showClientIdentifiers ? (
                  <View style={styles.kvBlock}>
                    {inv.client.ico ? (
                      <PdfKv first k={labels.ico} v={inv.client.ico} />
                    ) : null}
                    {inv.client.dic ? (
                      <PdfKv
                        first={!inv.client.ico}
                        k={labels.dic}
                        v={inv.client.dic}
                      />
                    ) : null}
                    {inv.client.contactEmail ? (
                      <PdfKv
                        first={!inv.client.ico && !inv.client.dic}
                        k={labels.contactEmail}
                        v={inv.client.contactEmail}
                      />
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.kvBlockGap}>
                  <PdfKv
                    first
                    k={labels.issueDate}
                    v={fmtDateIsoLocal(inv.meta.issueDate, intlLocale)}
                  />
                  <PdfKv
                    k={labels.dueDate}
                    v={fmtDateIsoLocal(inv.meta.dueDate, intlLocale)}
                  />
                  {showDuzp ? (
                    <PdfKv
                      k={labels.taxPointDate}
                      v={fmtDateIsoLocal(inv.meta.duzp, intlLocale)}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {inv.meta.docType === "credit_note" &&
          inv.meta.correctedInvoiceNumber ? (
            <Text style={[styles.partyAddr, { marginTop: 8 }]}>
              {labels.correctsDocument}{" "}
              <Text style={styles.creditInline}>
                {inv.meta.correctedInvoiceNumber}
              </Text>
            </Text>
          ) : null}

          <View style={styles.tableWrap}>
            <View style={styles.tableHeadRow}>
              <Text style={[styles.th, styles.thDesc]}>
                {labels.colDescription}
              </Text>
              <Text style={[styles.th, styles.thQty]}>{labels.colQty}</Text>
              <Text style={[styles.th, styles.thUnit]}>{labels.colUnit}</Text>
              <Text style={[styles.th, styles.thUnitPx]}>
                {labels.colUnitPrice}
              </Text>
              <Text style={[styles.th, styles.thVat]}>{labels.colVat}</Text>
              <Text style={[styles.th, styles.thTot]}>{labels.colTotal}</Text>
            </View>
            <View style={styles.tableRowsRule}>
              {sortedItems.map((it) => (
                <PdfInvoiceLineRow
                  key={it.position}
                  currency={inv.meta.currency}
                  item={it}
                  locale={intlLocale}
                />
              ))}
            </View>
          </View>

          <View style={styles.totalsBlock}>
            {inv.issuer.vatPayer ? (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLbl}>{labels.totalExVat}</Text>
                  <Text style={styles.totalFig}>
                    {fmtMoneyWithCurrency(
                      inv.totals.subtotal,
                      inv.meta.currency,
                      intlLocale,
                    )}
                  </Text>
                </View>
                {showRecapDetail
                  ? inv.totals.vatBreakdown.map((row) => (
                      <PdfVatRow
                        key={`${row.rate}`}
                        currency={inv.meta.currency}
                        labels={labels}
                        locale={intlLocale}
                        row={row}
                      />
                    ))
                  : null}
                {!showRecapDetail ? (
                  <View style={styles.totalLine}>
                    <Text style={styles.totalLbl}>{labels.vat}</Text>
                    <Text style={styles.totalFig}>
                      {fmtMoneyWithCurrency(
                        inv.totals.vatTotal,
                        inv.meta.currency,
                        intlLocale,
                      )}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            <View
              style={
                inv.issuer.vatPayer
                  ? styles.totalGrand
                  : [styles.totalGrand, styles.totalGrandNoVatIssuer]
              }
            >
              <Text style={styles.totalGrandLbl}>{labels.amountDue}</Text>
              <Text style={styles.totalGrandFig}>
                {fmtMoneyWithCurrency(
                  inv.totals.total,
                  inv.meta.currency,
                  intlLocale,
                )}
              </Text>
            </View>
          </View>

          {!inv.issuer.vatPayer ? (
            <Text style={styles.legalMini}>{labels.notVatPayerLegal}</Text>
          ) : null}

          {inv.vat.mode === "reverse_charge" ? (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.asideTitle}>{labels.reverseChargeTitle}</Text>
              <Text style={[styles.legalMini, { color: MUTED }]}>
                {inv.vat.legalNote ?? labels.reverseChargeDefault}
              </Text>
            </View>
          ) : null}

          {inv.vat.mode === "oss" ? (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.asideTitle}>{labels.ossTitle}</Text>
              <Text style={[styles.legalMini, { color: MUTED }]}>
                {inv.vat.legalNote ?? labels.ossDefault}
              </Text>
            </View>
          ) : null}

          {instructionsBefore ? (
            <View style={styles.paymentInstructionsBefore}>
              <PdfMarkdownText source={instructionsBefore} />
            </View>
          ) : null}

          <View
            style={
              instructionsBefore
                ? [styles.paymentOuter, styles.paymentOuterAfterInstructions]
                : styles.paymentOuter
            }
          >
            {hasQr && assets.qrDataUrl ? (
              <View style={styles.paymentQrCol}>
                <Image style={styles.qr} src={assets.qrDataUrl} />
              </View>
            ) : null}
            <View
              style={
                hasQr
                  ? [styles.paymentNoteCol, styles.paymentNoteColPadQr]
                  : styles.paymentNoteCol
              }
            >
              <Text style={styles.paySectionHeading}>
                {labels.paymentDetails}
              </Text>
              {transfer ? (
                <View style={[styles.kvBlock, styles.paymentDetailKv]}>
                  <PdfPaymentKv
                    first
                    k={labels.bankAccount}
                    v={transfer.accountNumber}
                  />
                  <PdfPaymentKv k="IBAN" v={formatIbanDisplay(transfer.iban)} />
                  {transfer.bic ? (
                    <PdfPaymentKv k="SWIFT / BIC" v={transfer.bic} />
                  ) : null}
                  {inv.payment.variableSymbol ? (
                    <PdfPaymentKv
                      k={labels.variableSymbol}
                      v={inv.payment.variableSymbol}
                    />
                  ) : null}
                  {inv.payment.constantSymbol ? (
                    <PdfPaymentKv
                      k={labels.constantSymbol}
                      v={inv.payment.constantSymbol}
                    />
                  ) : null}
                  {inv.payment.specificSymbol ? (
                    <PdfPaymentKv
                      k={labels.specificSymbol}
                      v={inv.payment.specificSymbol}
                    />
                  ) : null}
                  <PdfPaymentKv
                    k={labels.paymentMethod}
                    v={paymentMethodLabel(inv.payment.method, labels)}
                  />
                  {hasQr ? (
                    <Text style={styles.paymentHint}>{labels.qrHint}</Text>
                  ) : null}
                </View>
              ) : inv.payment.method === "cash" ? (
                <Text style={styles.payMethodTxt}>{labels.payCash}</Text>
              ) : (
                <Text style={styles.payMethodTxt}>{labels.payCard}</Text>
              )}
            </View>
          </View>

          {instructionsAfter ? (
            <View style={styles.paymentInstructionsAfter}>
              <PdfMarkdownText source={instructionsAfter} />
            </View>
          ) : null}

          {inv.notes ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.asideTitle}>{labels.notes}</Text>
              <Text style={styles.legalMini}>{inv.notes}</Text>
            </View>
          ) : null}

          {(showStamp && assets.stamp) ||
          (showSignature && assets.signature) ? (
            <View style={styles.stampSigRow}>
              {showStamp && assets.stamp ? (
                <Image style={styles.stampSig} src={assets.stamp} />
              ) : (
                <View />
              )}
              {showSignature && assets.signature ? (
                <View style={styles.stampSigBox}>
                  <Image style={styles.stampSig} src={assets.signature} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View fixed style={styles.footerRow} wrap={false}>
          <Link src={INVOICEY_SITE_URL} style={styles.footerBrand}>
            {labels.issuedVia}{" "}
            <Text style={styles.footerBrandStrong}>Invoicey</Text>
          </Link>
        </View>
      </Page>
    </Document>
  );
}

function PdfVatRow({
  row,
  currency,
  labels,
  locale,
}: Readonly<{
  row: InvoiceVatBreakdownRowModel;
  currency: InvoiceCurrency;
  labels: InvoiceLabels;
  locale: string;
}>) {
  return (
    <View style={styles.totalLine}>
      <Text
        style={styles.totalLbl}
      >{`${labels.vat} ${String(row.rate)}\u00a0%`}</Text>
      <Text style={styles.totalFig}>
        {fmtMoneyWithCurrency(row.vat, currency, locale)}
      </Text>
    </View>
  );
}
