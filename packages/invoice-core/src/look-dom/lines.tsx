import React from "react";

import {
  formatInvoiceMoneyWithCurrency,
  formatInvoiceQty,
  splitDescription,
} from "../looks/format-invoice";
import { LINE_COLS_NO_VAT, LINE_COLS_WITH_VAT } from "../looks/line-columns";
import { invoicePdfShowsVatColumn } from "../pdf/pdf-presentation";
import {
  invoiceDisplayUnit,
  type InvoiceItem,
  type InvoiceLanguage,
} from "../schema";
import { LookBox, LookField, LookText } from "./field";
import type { LookDomCtx } from "./types";

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
  if (editing) return String(item.unitPriceWithoutVat);
  return formatInvoiceMoneyWithCurrency(
    item.unitPriceWithoutVat,
    ctx.invoice.meta.currency,
    ctx.intlLocale,
    ctx.invoice.meta.language,
  );
}

function vatFieldValue(item: InvoiceItem, editing: boolean): string {
  if (editing) return String(item.vatRate);
  return `${String(item.vatRate)}\u00a0%`;
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
  cols: typeof LINE_COLS_WITH_VAT | typeof LINE_COLS_NO_VAT;
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
    <LookBox style={styles.lineRow}>
      <LookBox extra={{ width: cols.desc }} style={styles.descCol}>
        <LookField
          ariaLabel={labels.colDescription}
          onChange={patch?.("description")}
          onEnter={
            onEdit && last ? () => onEdit({ type: "addLine" }) : undefined
          }
          style={styles.cellFig}
          value={editing ? item.description : split.title}
        />
        {!editing && split.detail ? (
          <LookText style={styles.lineSub}>{split.detail}</LookText>
        ) : null}
      </LookBox>
      <LookBox
        extra={{
          width: cols.qty,
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <LookField
          ariaLabel={labels.colQty}
          extra={{ textAlign: "right", width: "3.5rem" }}
          onChange={patch?.("quantity")}
          style={styles.cellFig}
          type="number"
          value={qtyFieldValue(item, editing, intlLocale, inv.meta.language)}
        />
        {editing ? (
          <LookField
            ariaLabel={labels.colUnit}
            extra={{ width: "2.2rem", marginLeft: 4, textAlign: "right" }}
            onChange={patch?.("unit")}
            style={styles.cellFig}
            value={item.unit}
          />
        ) : null}
      </LookBox>
      <LookField
        ariaLabel={labels.colUnitPrice}
        extra={{ width: cols.unitPx, textAlign: "right" }}
        onChange={patch?.("unitPriceWithoutVat")}
        style={styles.cellFig}
        type={editing ? "number" : "text"}
        value={priceFieldValue(item, ctx, editing)}
      />
      {showVat ? (
        <LookField
          ariaLabel={labels.colVat}
          extra={{ width: LINE_COLS_WITH_VAT.vat, textAlign: "right" }}
          onChange={patch?.("vatRate")}
          style={styles.cellFig}
          type={editing ? "number" : "text"}
          value={vatFieldValue(item, editing)}
        />
      ) : null}
      <LookText
        extra={{ width: cols.tot, textAlign: "right" }}
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
          aria-label="remove line"
          onClick={() => onEdit({ type: "removeLine", index })}
          style={{
            background: "none",
            border: "none",
            color: styles.kvKey.color,
            cursor: "pointer",
            fontSize: "7pt",
            padding: 0,
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
      <LookBox style={styles.tableHeadRow}>
        <LookText extra={{ width: cols.desc }} style={styles.th}>
          {labels.colDescription}
        </LookText>
        <LookText
          extra={{ width: cols.qty, textAlign: "right" }}
          style={styles.th}
        >
          {labels.colQty}
        </LookText>
        <LookText
          extra={{ width: cols.unitPx, textAlign: "right" }}
          style={styles.th}
        >
          {labels.colUnitPrice}
        </LookText>
        {showVat ? (
          <LookText
            extra={{ width: LINE_COLS_WITH_VAT.vat, textAlign: "right" }}
            style={styles.th}
          >
            {labels.colVat}
          </LookText>
        ) : null}
        <LookText
          extra={{ width: cols.tot, textAlign: "right" }}
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
          onClick={() => onEdit({ type: "addLine" })}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            color: styles.kvKey.color,
            cursor: "pointer",
            fontSize: "8pt",
            marginTop: 6,
            padding: 0,
          }}
          type="button"
        >
          +
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
        style={ctx.styles.legalMini}
        value={ctx.invoice.notes ?? ""}
      />
    </LookBox>
  );
}
