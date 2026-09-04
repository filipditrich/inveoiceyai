import React from "react";

import {
  formatInvoiceMoneyWithCurrency,
  formatInvoiceQty,
  splitDescription,
} from "../looks/format-invoice";
import {
  LINE_COLS_NO_VAT,
  LINE_COLS_WITH_VAT,
  lineGridTemplate,
  type LineCols,
} from "../looks/line-columns";
import { invoicePdfShowsVatColumn } from "../pdf/pdf-presentation";
import {
  invoiceDisplayUnit,
  currencyDisplaySuffix,
  type InvoiceItem,
  type InvoiceLanguage,
} from "../schema";
import { LookBox, LookField, LookText } from "./field";
import type { LookDomCtx } from "./types";

const CELL_CLIP: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  width: "100%",
};

function lineGridExtra(cols: LineCols): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: lineGridTemplate(cols),
    position: "relative",
    width: "100%",
  };
}

function qtyFieldValue(
  item: InvoiceItem,
  editing: boolean,
  locale: string,
  language: InvoiceLanguage,
): string {
  if (editing) return String(item.quantity);
  const unit = item.unit
    ? `\u00a0${invoiceDisplayUnit(item.unit, language)}`
    : "";
  return `${formatInvoiceQty(item.quantity, locale)}${unit}`;
}

function priceFieldValue(
  item: InvoiceItem,
  ctx: LookDomCtx,
  editing: boolean,
): string {
  if (editing) return editMoneyValue(item.unitPriceWithoutVat, ctx.intlLocale);
  return formatInvoiceMoneyWithCurrency(
    item.unitPriceWithoutVat,
    ctx.invoice.meta.currency,
    ctx.intlLocale,
    ctx.invoice.meta.language,
  );
}

function editMoneyValue(amount: number, locale: string): string {
  const fixed = amount.toFixed(2);
  return locale.startsWith("cs") ? fixed.replace(".", ",") : fixed;
}

function vatFieldValue(item: InvoiceItem, editing: boolean): string {
  if (editing) return String(item.vatRate);
  return `${String(item.vatRate)}\u00a0%`;
}

function LineAffixCell({
  ariaLabel,
  value,
  onChange,
  affix,
  style,
}: {
  ariaLabel: string;
  value: string;
  onChange?: (value: string) => void;
  affix: string;
  style: LookDomCtx["styles"]["cellFig"];
}) {
  return (
    <LookBox
      extra={{
        ...CELL_CLIP,
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "baseline",
        gap: 2,
      }}
    >
      <LookField
        ariaLabel={ariaLabel}
        extra={{ textAlign: "right", width: "auto", flex: 1, minWidth: 0 }}
        inputMode={onChange ? "decimal" : undefined}
        onChange={onChange}
        style={style}
        value={value}
      />
      {onChange ? (
        <LookText extra={{ flexShrink: 0 }} style={style}>
          {affix}
        </LookText>
      ) : null}
    </LookBox>
  );
}

function DomInvoiceLineRow({
  ctx,
  item,
  index,
  last,
  lineCount,
  showVat,
  cols,
}: {
  ctx: LookDomCtx;
  item: InvoiceItem;
  index: number;
  last: boolean;
  lineCount: number;
  showVat: boolean;
  cols: LineCols;
}) {
  const { invoice: inv, labels, intlLocale, styles, onEdit } = ctx;
  const split = splitDescription(item.description);
  const editing = Boolean(onEdit);
  const patch = onEdit
    ? (
        field:
          | "description"
          | "quantity"
          | "unit"
          | "unitPriceWithoutVat"
          | "vatRate",
      ) =>
        (value: string) =>
          onEdit({ type: "line", index, field, value })
    : undefined;
  return (
    <LookBox extra={lineGridExtra(cols)} style={styles.lineRow}>
      <LookBox extra={CELL_CLIP} style={styles.descCol}>
        <LookField
          ariaLabel={labels.colDescription}
          onChange={patch?.("description")}
          onEnter={
            onEdit && last ? () => onEdit({ type: "addLine" }) : undefined
          }
          placeholder={ctx.placeholders.line}
          style={styles.cellFig}
          value={editing ? item.description : split.title}
        />
        {!editing && split.detail ? (
          <LookText style={styles.lineSub}>{split.detail}</LookText>
        ) : null}
      </LookBox>
      <LookBox
        extra={{
          ...CELL_CLIP,
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 4,
        }}
      >
        <LookField
          ariaLabel={labels.colQty}
          extra={{
            textAlign: "right",
            minWidth: "1.6rem",
            flex: 1,
            width: "auto",
          }}
          inputMode="decimal"
          onChange={patch?.("quantity")}
          style={styles.cellFig}
          value={qtyFieldValue(item, editing, intlLocale, inv.meta.language)}
        />
        {editing ? (
          <LookField
            ariaLabel={labels.colUnit}
            extra={{
              width: "2.2rem",
              minWidth: "2.2rem",
              flexShrink: 0,
              textAlign: "right",
            }}
            onChange={patch?.("unit")}
            placeholder={ctx.placeholders.unit}
            style={styles.cellFig}
            value={invoiceDisplayUnit(item.unit, inv.meta.language)}
          />
        ) : null}
      </LookBox>
      <LineAffixCell
        affix={currencyDisplaySuffix(inv.meta.currency, inv.meta.language)}
        ariaLabel={labels.colUnitPrice}
        onChange={patch?.("unitPriceWithoutVat")}
        style={styles.cellFig}
        value={priceFieldValue(item, ctx, editing)}
      />
      {showVat ? (
        <LineAffixCell
          affix="%"
          ariaLabel={labels.colVat}
          onChange={patch?.("vatRate")}
          style={styles.cellFig}
          value={vatFieldValue(item, editing)}
        />
      ) : null}
      <LookText
        extra={{ ...CELL_CLIP, textAlign: "right" }}
        style={styles.cellFigStrong}
      >
        {formatInvoiceMoneyWithCurrency(
          item.lineTotal,
          inv.meta.currency,
          intlLocale,
          inv.meta.language,
        )}
      </LookText>
      {onEdit && lineCount > 1 ? (
        <button
          aria-label={ctx.placeholders.removeLine}
          onClick={() => onEdit({ type: "removeLine", index })}
          style={{
            alignItems: "center",
            background: "none",
            border: "none",
            bottom: 0,
            color: styles.kvKey.color,
            cursor: "pointer",
            display: "flex",
            fontSize: "8pt",
            height: 16,
            justifyContent: "center",
            lineHeight: 1,
            marginBottom: "auto",
            marginTop: "auto",
            padding: 0,
            position: "absolute",
            right: -14,
            top: 0,
            width: 16,
          }}
          type="button"
        >
          ×
        </button>
      ) : null}
    </LookBox>
  );
}

export function renderLines(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles, onEdit } = ctx;
  const sorted = [...inv.items].sort((a, b) => a.position - b.position);
  const showVat = invoicePdfShowsVatColumn(inv);
  const cols = showVat ? LINE_COLS_WITH_VAT : LINE_COLS_NO_VAT;
  return (
    <LookBox lookBlock="lines" style={styles.tableWrap}>
      <LookBox extra={lineGridExtra(cols)} style={styles.tableHeadRow}>
        <LookText extra={CELL_CLIP} style={styles.th}>
          {labels.colDescription}
        </LookText>
        <LookText
          extra={{ ...CELL_CLIP, textAlign: "right" }}
          style={styles.th}
        >
          {labels.colQty}
        </LookText>
        <LookText
          extra={{ ...CELL_CLIP, textAlign: "right" }}
          style={styles.th}
        >
          {labels.colUnitPrice}
        </LookText>
        {showVat ? (
          <LookText
            extra={{ ...CELL_CLIP, textAlign: "right" }}
            style={styles.th}
          >
            {labels.colVat}
          </LookText>
        ) : null}
        <LookText
          extra={{ ...CELL_CLIP, textAlign: "right" }}
          style={styles.th}
        >
          {labels.colTotal}
        </LookText>
      </LookBox>
      <LookBox style={styles.tableRowsRule}>
        {sorted.map((item, index) => (
          <DomInvoiceLineRow
            cols={cols}
            ctx={ctx}
            index={index}
            item={item}
            key={item.position}
            last={index === sorted.length - 1}
            lineCount={sorted.length}
            showVat={showVat}
          />
        ))}
      </LookBox>
      {onEdit ? (
        <button
          aria-label={ctx.placeholders.addLine}
          onClick={() => onEdit({ type: "addLine" })}
          style={{
            alignSelf: "flex-start",
            background: "color-mix(in srgb, currentColor 6%, transparent)",
            border:
              "1px solid color-mix(in srgb, currentColor 18%, transparent)",
            borderRadius: 3,
            color: styles.kvKey.color,
            cursor: "pointer",
            fontSize: "7.5pt",
            letterSpacing: "0.02em",
            marginTop: 8,
            padding: "3px 8px",
          }}
          type="button"
        >
          {`+ ${ctx.placeholders.addLine}`}
        </button>
      ) : null}
    </LookBox>
  );
}

export function renderTotals(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, intlLocale, styles } = ctx;
  const showRecap =
    inv.issuer.vatPayer &&
    inv.vat.mode === "regular" &&
    inv.totals.vatBreakdown.length > 0 &&
    inv.totals.vatTotal > 0;
  return (
    <LookBox editable={false} lookBlock="totals" style={styles.totalsBlock}>
      {inv.issuer.vatPayer ? (
        <>
          <LookBox style={styles.totalLine}>
            <LookText style={styles.totalLbl}>{labels.totalExVat}</LookText>
            <LookText style={styles.totalFig}>
              {formatInvoiceMoneyWithCurrency(
                inv.totals.subtotal,
                inv.meta.currency,
                intlLocale,
                inv.meta.language,
              )}
            </LookText>
          </LookBox>
          {showRecap ? (
            inv.totals.vatBreakdown.map((row) => (
              <LookBox key={`${row.rate}`} style={styles.totalLine}>
                <LookText style={styles.totalLbl}>
                  {`${labels.vat} ${String(row.rate)}\u00a0%`}
                </LookText>
                <LookText style={styles.totalFig}>
                  {formatInvoiceMoneyWithCurrency(
                    row.vat,
                    inv.meta.currency,
                    intlLocale,
                    inv.meta.language,
                  )}
                </LookText>
              </LookBox>
            ))
          ) : (
            <LookBox style={styles.totalLine}>
              <LookText style={styles.totalLbl}>{labels.vat}</LookText>
              <LookText style={styles.totalFig}>
                {formatInvoiceMoneyWithCurrency(
                  inv.totals.vatTotal,
                  inv.meta.currency,
                  intlLocale,
                  inv.meta.language,
                )}
              </LookText>
            </LookBox>
          )}
        </>
      ) : null}
      <LookBox
        style={
          inv.issuer.vatPayer
            ? styles.totalGrand
            : { ...styles.totalGrand, ...styles.totalGrandNoVatIssuer }
        }
      >
        <LookText style={styles.totalGrandLbl}>{labels.amountDue}</LookText>
        <LookText style={styles.totalGrandFig}>
          {formatInvoiceMoneyWithCurrency(
            inv.totals.total,
            inv.meta.currency,
            intlLocale,
            inv.meta.language,
          )}
        </LookText>
      </LookBox>
    </LookBox>
  );
}

export function renderTax(ctx: LookDomCtx): React.ReactElement | null {
  const { invoice: inv, labels, styles } = ctx;
  if (!inv.issuer.vatPayer) {
    return (
      <LookBox editable={false} lookBlock="tax">
        <LookText style={styles.legalMini}>{labels.notVatPayerLegal}</LookText>
      </LookBox>
    );
  }
  if (inv.vat.mode === "reverse_charge") {
    return (
      <LookBox editable={false} extra={{ marginTop: 6 }} lookBlock="tax">
        <LookText style={styles.asideTitle}>
          {labels.reverseChargeTitle}
        </LookText>
        <LookText style={styles.legalMini}>
          {inv.vat.legalNote ?? labels.reverseChargeDefault}
        </LookText>
      </LookBox>
    );
  }
  if (inv.vat.mode === "oss") {
    return (
      <LookBox editable={false} extra={{ marginTop: 6 }} lookBlock="tax">
        <LookText style={styles.asideTitle}>{labels.ossTitle}</LookText>
        <LookText style={styles.legalMini}>
          {inv.vat.legalNote ?? labels.ossDefault}
        </LookText>
      </LookBox>
    );
  }
  return null;
}

export function renderNotes(ctx: LookDomCtx): React.ReactElement | null {
  if (!ctx.look.theme.showNotes && !ctx.onEdit) return null;
  if (!ctx.invoice.notes && !ctx.onEdit) return null;
  return (
    <LookBox extra={{ marginTop: 10 }} lookBlock="notes">
      <LookText style={ctx.styles.asideTitle}>{ctx.labels.notes}</LookText>
      <LookField
        ariaLabel={ctx.labels.notes}
        multiline
        onChange={
          ctx.onEdit
            ? (value) => ctx.onEdit?.({ type: "notes", value })
            : undefined
        }
        placeholder={ctx.placeholders.notes}
        style={ctx.styles.legalMini}
        value={ctx.invoice.notes ?? ""}
      />
    </LookBox>
  );
}
