/** @jsxImportSource react */
import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer";
import React from "react";

import type {
  Invoice,
  InvoiceCurrency,
  InvoiceItem,
  InvoiceLanguage,
} from "../schema";
import { currencyDisplaySuffix, invoiceDisplayUnit } from "../schema";
import {
  invoiceLabels,
  toInvoiceIntlLocale,
  type InvoiceLabels,
} from "../labels";
import {
  lookHasBlock,
  resolveLookDocument,
  validateLookForInvoice,
  type BlockInstance,
  type LookBand,
  type LookDocument,
} from "../looks";
import { parseInlineMarkdown } from "./inline-markdown";
import { keepPdfWord } from "./register-fonts";
import {
  invoicePdfDocKindSubtitle,
  invoicePdfMainTitle,
  invoicePdfShowsVatColumn,
  invoicePdfTaxPointLabel,
} from "./pdf-presentation";
import {
  createInvoicePdfStyles,
  rowColumnStyle,
  type InvoicePdfStyles,
} from "./look-styles";

const LINE_COLS_WITH_VAT = {
  desc: "42%",
  qty: "15%",
  unitPx: "18%",
  vat: "6%",
  tot: "19%",
} as const;

const LINE_COLS_NO_VAT = {
  desc: "46%",
  qty: "17%",
  unitPx: "18%",
  tot: "19%",
} as const;

const INVOICEY_SITE_URL = "https://invoicey.ditrich.me/";

type InvoiceVatBreakdownRowModel = Invoice["totals"]["vatBreakdown"][number];

export interface InvoicePdfAssets {
  readonly qrDataUrl?: string | null;
  readonly logo?: Buffer;
  readonly stamp?: Buffer;
  readonly signature?: Buffer;
}

type PdfCtx = {
  readonly inv: Invoice;
  readonly assets: InvoicePdfAssets;
  readonly labels: InvoiceLabels;
  readonly intlLocale: string;
  readonly look: LookDocument;
  readonly styles: InvoicePdfStyles;
};

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
  language: InvoiceLanguage,
): string {
  return `${fmtMoneyAmount(n, locale)}\u00a0${currencyDisplaySuffix(currency, language)}`;
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

function postalCityLine(zip: string, city: string): string {
  return `${zip} ${city}`;
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
  styles,
}: Readonly<{
  k: string;
  v: string;
  first?: boolean;
  styles: InvoicePdfStyles;
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
  styles,
}: Readonly<{
  k: string;
  v: string;
  first?: boolean;
  styles: InvoicePdfStyles;
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
  styles,
}: Readonly<{
  source: string;
  styles: InvoicePdfStyles;
}>) {
  const blocks = source.split(/\n{2,}/u);
  return (
    <View>
      {blocks.map((block, i) => (
        <Text
          key={`md-${String(i)}`}
          style={
            i > 0
              ? [styles.paymentInstructions, { marginTop: 6 }]
              : styles.paymentInstructions
          }
        >
          {parseInlineMarkdown(block.replaceAll("\n", " ")).map((span, j) => (
            <Text
              key={`s-${String(j)}`}
              style={{
                fontFamily: "Inter",
                fontWeight: span.bold ? 700 : 400,
                fontStyle: span.italic ? "italic" : "normal",
              }}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

function PdfInvoiceLineRow({
  item,
  currency,
  language,
  locale,
  showVat,
  styles,
}: Readonly<{
  item: InvoiceItem;
  currency: InvoiceCurrency;
  language: InvoiceLanguage;
  locale: string;
  showVat: boolean;
  styles: InvoicePdfStyles;
}>) {
  const split = splitDescription(item.description);
  const cols = showVat ? LINE_COLS_WITH_VAT : LINE_COLS_NO_VAT;
  return (
    <View style={styles.lineRow} wrap={false}>
      <View style={[styles.descCol, { width: cols.desc }]}>
        <Text style={styles.cellFig}>{split.title}</Text>
        {split.detail ? (
          <Text style={styles.lineSub}>{split.detail}</Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.cellFig,
          { width: cols.qty, textAlign: "right", paddingRight: 4 },
        ]}
      >
        {fmtQty(item.quantity, locale)}
        {item.unit ? `\u00a0${invoiceDisplayUnit(item.unit, language)}` : ""}
      </Text>
      <Text
        hyphenationCallback={keepPdfWord}
        style={[styles.cellFig, { width: cols.unitPx, textAlign: "right" }]}
        wrap={false}
      >
        {fmtMoneyWithCurrency(
          item.unitPriceWithoutVat,
          currency,
          locale,
          language,
        )}
      </Text>
      {showVat ? (
        <Text
          style={[
            styles.cellFig,
            {
              width: LINE_COLS_WITH_VAT.vat,
              textAlign: "right",
              paddingRight: 2,
            },
          ]}
        >
          {`${String(item.vatRate)}\u00a0%`}
        </Text>
      ) : null}
      <Text
        hyphenationCallback={keepPdfWord}
        style={[styles.cellFigStrong, { width: cols.tot, textAlign: "right" }]}
        wrap={false}
      >
        {fmtMoneyWithCurrency(item.lineTotal, currency, locale, language)}
      </Text>
    </View>
  );
}

function PdfVatRow({
  row,
  currency,
  labels,
  language,
  locale,
  styles,
}: Readonly<{
  row: InvoiceVatBreakdownRowModel;
  currency: InvoiceCurrency;
  labels: InvoiceLabels;
  language: InvoiceLanguage;
  locale: string;
  styles: InvoicePdfStyles;
}>) {
  return (
    <View style={styles.totalLine}>
      <Text
        style={styles.totalLbl}
      >{`${labels.vat} ${String(row.rate)}\u00a0%`}</Text>
      <Text style={styles.totalFig}>
        {fmtMoneyWithCurrency(row.vat, currency, locale, language)}
      </Text>
    </View>
  );
}

function renderLogo(ctx: PdfCtx): React.ReactElement | null {
  if (!ctx.assets.logo) return null;
  return <Image style={ctx.styles.logoImg} src={ctx.assets.logo} />;
}

function renderDateFields(
  ctx: PdfCtx,
  boxStyle: InvoicePdfStyles["kvBlock"] | InvoicePdfStyles["partyMeta"],
): React.ReactElement {
  const { inv, labels, intlLocale, styles } = ctx;
  const showDuzp =
    inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";
  return (
    <View style={boxStyle}>
      <PdfKv
        first
        k={labels.issueDate}
        v={fmtDateIsoLocal(inv.meta.issueDate, intlLocale)}
        styles={styles}
      />
      <PdfKv
        k={labels.dueDate}
        v={fmtDateIsoLocal(inv.meta.dueDate, intlLocale)}
        styles={styles}
      />
      {showDuzp ? (
        <PdfKv
          k={invoicePdfTaxPointLabel(inv, labels)}
          v={fmtDateIsoLocal(inv.meta.duzp, intlLocale)}
          styles={styles}
        />
      ) : null}
    </View>
  );
}

function renderTitle(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, styles, look } = ctx;
  const subtitle = invoicePdfDocKindSubtitle(inv, labels);
  return (
    <View>
      <View style={styles.titleColRule} />
      <Text style={styles.invoiceTitle}>
        {invoicePdfMainTitle(inv, labels)}
      </Text>
      {subtitle ? <Text style={styles.docKindMicro}>{subtitle}</Text> : null}
      {lookHasBlock(look, "dates")
        ? null
        : renderDateFields(ctx, styles.kvBlock)}
      {inv.meta.docType === "credit_note" && inv.meta.correctedInvoiceNumber ? (
        <Text style={[styles.partyAddr, { marginTop: 8 }]}>
          {labels.correctsDocument}{" "}
          <Text style={styles.creditInline}>
            {inv.meta.correctedInvoiceNumber}
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

function renderDates(ctx: PdfCtx): React.ReactElement {
  return renderDateFields(ctx, ctx.styles.partyMeta);
}

function renderIssuer(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, styles } = ctx;
  const issuerCountry = countryHuman(inv.issuer.address.country, labels);
  return (
    <View>
      <View style={styles.sectionHairShort} />
      <Text style={styles.sectionCaps}>{labels.supplier}</Text>
      <Text style={styles.partyName}>{inv.issuer.name}</Text>
      <Text style={styles.partyAddr}>{inv.issuer.address.street}</Text>
      <Text style={styles.partyAddrTight}>
        {postalCityLine(inv.issuer.address.zip, inv.issuer.address.city)}
      </Text>
      <Text style={styles.partyAddrTight}>{issuerCountry}</Text>
      <View style={styles.kvBlock}>
        <PdfKv first k={labels.ico} v={inv.issuer.ico} styles={styles} />
        {inv.issuer.vatPayer && inv.issuer.dic ? (
          <PdfKv k={labels.dic} v={inv.issuer.dic} styles={styles} />
        ) : null}
        {!inv.issuer.vatPayer ? (
          <PdfKv k={labels.vat} v={labels.nonVatPayer} styles={styles} />
        ) : null}
        <PdfKv
          k={labels.contactEmail}
          v={inv.issuer.contactEmail}
          styles={styles}
        />
      </View>
      {inv.issuer.registryNote ? (
        <Text style={styles.registryNote}>{inv.issuer.registryNote}</Text>
      ) : null}
    </View>
  );
}

function renderClient(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, styles } = ctx;
  const clientCountry = countryHuman(inv.client.address.country, labels);
  const showClientIdentifiers =
    Boolean(inv.client.ico) ||
    Boolean(inv.client.dic) ||
    Boolean(inv.client.contactEmail);
  return (
    <View>
      <View style={styles.sectionHairShort} />
      <Text style={styles.sectionCaps}>{labels.customer}</Text>
      <Text style={styles.partyName}>{inv.client.name}</Text>
      <Text style={styles.partyAddr}>{inv.client.address.street}</Text>
      <Text style={styles.partyAddrTight}>
        {postalCityLine(inv.client.address.zip, inv.client.address.city)}
      </Text>
      <Text style={styles.partyAddrTight}>{clientCountry}</Text>
      {showClientIdentifiers ? (
        <View style={styles.kvBlock}>
          {inv.client.ico ? (
            <PdfKv first k={labels.ico} v={inv.client.ico} styles={styles} />
          ) : null}
          {inv.client.dic ? (
            <PdfKv
              first={!inv.client.ico}
              k={labels.dic}
              v={inv.client.dic}
              styles={styles}
            />
          ) : null}
          {inv.client.contactEmail ? (
            <PdfKv
              first={!inv.client.ico && !inv.client.dic}
              k={labels.contactEmail}
              v={inv.client.contactEmail}
              styles={styles}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function renderPaymentCompact(ctx: PdfCtx): React.ReactElement | null {
  const { inv, labels, styles } = ctx;
  const transfer = inv.payment.method === "transfer" && inv.payment.bankAccount;
  return (
    <View style={styles.partyMeta}>
      {transfer ? (
        <PdfKv
          first
          k={labels.bankAccount}
          v={transfer.accountNumber}
          styles={styles}
        />
      ) : null}
      {transfer && inv.payment.variableSymbol ? (
        <PdfKv
          k={labels.variableSymbol}
          v={inv.payment.variableSymbol}
          styles={styles}
        />
      ) : null}
      <PdfKv
        first={!transfer}
        k={labels.paymentMethod}
        v={paymentMethodLabel(inv.payment.method, labels)}
        styles={styles}
      />
    </View>
  );
}

function renderPaymentFull(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, styles } = ctx;
  const transfer = inv.payment.method === "transfer" && inv.payment.bankAccount;
  const instructionsBefore = inv.payment.instructionsBefore?.trim() || null;
  const instructionsAfter = inv.payment.instructionsAfter?.trim() || null;
  return (
    <View>
      {instructionsBefore ? (
        <View style={styles.paymentInstructionsBefore}>
          <PdfMarkdownText source={instructionsBefore} styles={styles} />
        </View>
      ) : null}
      <View style={styles.paymentBlock}>
        <Text style={styles.paySectionHeading}>{labels.paymentDetails}</Text>
        {transfer ? (
          <View style={[styles.kvBlock, styles.paymentDetailKv]}>
            <PdfPaymentKv
              first
              k={labels.bankAccount}
              v={transfer.accountNumber}
              styles={styles}
            />
            <PdfPaymentKv
              k="IBAN"
              v={formatIbanDisplay(transfer.iban)}
              styles={styles}
            />
            {transfer.bic ? (
              <PdfPaymentKv k="SWIFT / BIC" v={transfer.bic} styles={styles} />
            ) : null}
            {inv.payment.variableSymbol ? (
              <PdfPaymentKv
                k={labels.variableSymbol}
                v={inv.payment.variableSymbol}
                styles={styles}
              />
            ) : null}
            {inv.payment.constantSymbol ? (
              <PdfPaymentKv
                k={labels.constantSymbol}
                v={inv.payment.constantSymbol}
                styles={styles}
              />
            ) : null}
            {inv.payment.specificSymbol ? (
              <PdfPaymentKv
                k={labels.specificSymbol}
                v={inv.payment.specificSymbol}
                styles={styles}
              />
            ) : null}
            <PdfPaymentKv
              k={labels.paymentMethod}
              v={paymentMethodLabel(inv.payment.method, labels)}
              styles={styles}
            />
          </View>
        ) : inv.payment.method === "cash" ? (
          <Text style={styles.payMethodTxt}>{labels.payCash}</Text>
        ) : (
          <Text style={styles.payMethodTxt}>{labels.payCard}</Text>
        )}
      </View>
      {instructionsAfter ? (
        <View style={styles.paymentInstructionsAfter}>
          <PdfMarkdownText source={instructionsAfter} styles={styles} />
        </View>
      ) : null}
    </View>
  );
}

function renderQr(ctx: PdfCtx): React.ReactElement | null {
  if (!ctx.look.theme.showQr || !ctx.assets.qrDataUrl) return null;
  return (
    <View>
      <Image style={ctx.styles.qr} src={ctx.assets.qrDataUrl} />
      <Text style={ctx.styles.paymentHint}>{ctx.labels.qrHint}</Text>
    </View>
  );
}

function renderLines(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, intlLocale, styles } = ctx;
  const sortedItems = [...inv.items].sort((a, b) => a.position - b.position);
  const showVat = invoicePdfShowsVatColumn(inv);
  const cols = showVat ? LINE_COLS_WITH_VAT : LINE_COLS_NO_VAT;
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeadRow}>
        <Text style={[styles.th, { width: cols.desc }]}>
          {labels.colDescription}
        </Text>
        <Text style={[styles.th, styles.thQty, { width: cols.qty }]}>
          {labels.colQty}
        </Text>
        <Text style={[styles.th, styles.thUnitPx, { width: cols.unitPx }]}>
          {labels.colUnitPrice}
        </Text>
        {showVat ? (
          <Text
            style={[styles.th, styles.thVat, { width: LINE_COLS_WITH_VAT.vat }]}
          >
            {labels.colVat}
          </Text>
        ) : null}
        <Text style={[styles.th, styles.thTot, { width: cols.tot }]}>
          {labels.colTotal}
        </Text>
      </View>
      <View style={styles.tableRowsRule}>
        {sortedItems.map((it) => (
          <PdfInvoiceLineRow
            key={it.position}
            currency={inv.meta.currency}
            item={it}
            language={inv.meta.language}
            locale={intlLocale}
            showVat={showVat}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function renderTotals(ctx: PdfCtx): React.ReactElement {
  const { inv, labels, intlLocale, styles } = ctx;
  const showRecapDetail =
    inv.issuer.vatPayer &&
    inv.vat.mode === "regular" &&
    inv.totals.vatBreakdown.length > 0 &&
    inv.totals.vatTotal > 0;
  return (
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
                inv.meta.language,
              )}
            </Text>
          </View>
          {showRecapDetail
            ? inv.totals.vatBreakdown.map((row) => (
                <PdfVatRow
                  key={`${row.rate}`}
                  currency={inv.meta.currency}
                  labels={labels}
                  language={inv.meta.language}
                  locale={intlLocale}
                  row={row}
                  styles={styles}
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
                  inv.meta.language,
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
            inv.meta.language,
          )}
        </Text>
      </View>
    </View>
  );
}

function renderTax(ctx: PdfCtx): React.ReactElement | null {
  const { inv, labels, styles } = ctx;
  if (!inv.issuer.vatPayer) {
    return <Text style={styles.legalMini}>{labels.notVatPayerLegal}</Text>;
  }
  if (inv.vat.mode === "reverse_charge") {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={styles.asideTitle}>{labels.reverseChargeTitle}</Text>
        <Text style={styles.legalMini}>
          {inv.vat.legalNote ?? labels.reverseChargeDefault}
        </Text>
      </View>
    );
  }
  if (inv.vat.mode === "oss") {
    return (
      <View style={{ marginTop: 6 }}>
        <Text style={styles.asideTitle}>{labels.ossTitle}</Text>
        <Text style={styles.legalMini}>
          {inv.vat.legalNote ?? labels.ossDefault}
        </Text>
      </View>
    );
  }
  return null;
}

function renderNotes(ctx: PdfCtx): React.ReactElement | null {
  if (!ctx.look.theme.showNotes || !ctx.inv.notes) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={ctx.styles.asideTitle}>{ctx.labels.notes}</Text>
      <Text style={ctx.styles.legalMini}>{ctx.inv.notes}</Text>
    </View>
  );
}

function renderStamp(
  ctx: PdfCtx,
  column?: "start" | "end",
): React.ReactElement | null {
  if (!ctx.look.theme.showStamp || !ctx.assets.stamp) return null;
  const image = <Image style={ctx.styles.stampSig} src={ctx.assets.stamp} />;
  if (column !== "end") return image;
  return <View style={ctx.styles.stampWrapEnd}>{image}</View>;
}

function renderSignature(ctx: PdfCtx): React.ReactElement | null {
  if (!ctx.look.theme.showSignature || !ctx.assets.signature) return null;
  return <Image style={ctx.styles.signatureImg} src={ctx.assets.signature} />;
}

function renderFooter(ctx: PdfCtx): React.ReactElement {
  return (
    <View fixed style={ctx.styles.footerRow} wrap={false}>
      <Link src={INVOICEY_SITE_URL} style={ctx.styles.footerBrand}>
        {ctx.labels.issuedVia}{" "}
        <Text style={ctx.styles.footerBrandStrong}>Invoicey</Text>
      </Link>
    </View>
  );
}

function renderBlock(
  ctx: PdfCtx,
  slot: BlockInstance,
  column?: "start" | "end",
): React.ReactElement | null {
  switch (slot.block) {
    case "logo":
      return renderLogo(ctx);
    case "title":
      return renderTitle(ctx);
    case "issuer":
      return renderIssuer(ctx);
    case "client":
      return renderClient(ctx);
    case "dates":
      return renderDates(ctx);
    case "payment":
      return slot.variant === "compact"
        ? renderPaymentCompact(ctx)
        : renderPaymentFull(ctx);
    case "qr":
      return renderQr(ctx);
    case "lines":
      return renderLines(ctx);
    case "totals":
      return renderTotals(ctx);
    case "tax":
      return renderTax(ctx);
    case "notes":
      return renderNotes(ctx);
    case "stamp":
      return renderStamp(ctx, column);
    case "signature":
      return renderSignature(ctx);
    case "footer":
      return renderFooter(ctx);
    default: {
      const _never: never = slot.block;
      return _never;
    }
  }
}

function renderSlotColumn(
  ctx: PdfCtx,
  slots: readonly BlockInstance[],
  column?: "start" | "end",
): React.ReactElement | null {
  const children = slots
    .map((slot, index) => {
      const node = renderBlock(ctx, slot, column);
      return node ? (
        <View key={`${slot.block}-${String(index)}`}>{node}</View>
      ) : null;
    })
    .filter(Boolean);
  if (children.length === 0) return null;
  return <View>{children}</View>;
}

function renderBand(
  ctx: PdfCtx,
  band: LookBand,
  index: number,
): React.ReactElement | null {
  if (band.type === "footer") return null;
  if (band.type === "stack") {
    const column = renderSlotColumn(ctx, band.slots);
    if (!column) return null;
    return (
      <View
        key={`band-${String(index)}`}
        style={index === 0 ? ctx.styles.colFull : ctx.styles.bandStack}
      >
        {column}
      </View>
    );
  }
  const start = renderSlotColumn(ctx, band.start, "start");
  const end = renderSlotColumn(ctx, band.end, "end");
  if (!start && !end) return null;
  if (!start)
    return (
      <View key={`band-${String(index)}`} style={ctx.styles.colFull}>
        {end}
      </View>
    );
  if (!end)
    return (
      <View key={`band-${String(index)}`} style={ctx.styles.colFull}>
        {start}
      </View>
    );
  return (
    <View
      key={`band-${String(index)}`}
      style={
        index === 0
          ? [ctx.styles.bandRow, ctx.styles.bandRowFirst]
          : ctx.styles.bandRow
      }
    >
      <View style={rowColumnStyle(ctx.styles, band.split, "start")}>
        {start}
      </View>
      <View style={rowColumnStyle(ctx.styles, band.split, "end")}>{end}</View>
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
  const look = resolveLookDocument(inv);
  const issues = validateLookForInvoice(look, inv);
  if (issues.length > 0) {
    throw new Error(`invalid_look: ${issues.map((i) => i.message).join("; ")}`);
  }

  const labels = invoiceLabels(inv.meta.language);
  const intlLocale = toInvoiceIntlLocale(inv.meta.language);
  const styles = createInvoicePdfStyles(look.theme);
  const ctx: PdfCtx = { inv, assets, labels, intlLocale, look, styles };

  return (
    <Document title={invoicePdfMainTitle(inv, labels)} creator="Invoicey">
      <Page size="A4" style={styles.page}>
        <View style={styles.mainColumn}>
          {look.layout.bands.map((band, index) => renderBand(ctx, band, index))}
        </View>
        {renderFooter(ctx)}
      </Page>
    </Document>
  );
}
