import React from "react";

import { formatIbanDisplay, paymentMethodLabel } from "../looks/format-invoice";
import { parseInlineMarkdown } from "../pdf/inline-markdown";
import { cssFromLookBox } from "./css";
import { LookBox, LookText } from "./field";
import { DomKv, DomPaymentKv } from "./kv";
import type { LookDomCtx } from "./types";

function markdown(source: string, styles: LookDomCtx["styles"]) {
  const blocks = source.split(/\n{2,}/u);
  return (
    <LookBox>
      {blocks.map((block, i) => (
        <LookText
          extra={i > 0 ? { marginTop: 6 } : undefined}
          key={`md-${String(i)}`}
          style={styles.paymentInstructions}
        >
          {parseInlineMarkdown(block.replaceAll("\n", " ")).map((span, j) => (
            <span
              key={`s-${String(j)}`}
              style={{
                fontWeight: span.bold ? 700 : 400,
                fontStyle: span.italic ? "italic" : "normal",
              }}
            >
              {span.text}
            </span>
          ))}
        </LookText>
      ))}
    </LookBox>
  );
}

export function renderPayment(ctx: LookDomCtx, compact: boolean) {
  return compact ? renderPaymentCompact(ctx) : renderPaymentFull(ctx);
}

function renderPaymentCompact(ctx: LookDomCtx): React.ReactElement | null {
  const { invoice: inv, labels, styles, onEdit, placeholders } = ctx;
  const transfer = inv.payment.method === "transfer" && inv.payment.bankAccount;
  return (
    <LookBox lookBlock="payment" style={styles.partyMeta}>
      {inv.payment.method === "transfer" ? (
        <DomKv
          first
          ariaLabel={labels.bankAccount}
          k={labels.bankAccount}
          onChange={
            onEdit
              ? (value) =>
                  onEdit({ type: "bank", field: "accountNumber", value })
              : undefined
          }
          placeholder={placeholders.account}
          styles={styles}
          v={transfer ? transfer.accountNumber : ""}
        />
      ) : null}
      {transfer && inv.payment.variableSymbol ? (
        <DomKv
          k={labels.variableSymbol}
          styles={styles}
          v={inv.payment.variableSymbol}
        />
      ) : null}
      <DomKv
        first={inv.payment.method !== "transfer"}
        k={labels.paymentMethod}
        styles={styles}
        v={paymentMethodLabel(inv.payment.method, labels)}
      />
    </LookBox>
  );
}

function renderPaymentFull(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles, onEdit, placeholders } = ctx;
  const transfer = inv.payment.method === "transfer" && inv.payment.bankAccount;
  const instructionsBefore = inv.payment.instructionsBefore?.trim() || null;
  const instructionsAfter = inv.payment.instructionsAfter?.trim() || null;
  return (
    <LookBox lookBlock="payment">
      {instructionsBefore ? (
        <LookBox style={styles.paymentInstructionsBefore}>
          {markdown(instructionsBefore, styles)}
        </LookBox>
      ) : null}
      <LookBox style={styles.paymentBlock}>
        <LookText style={styles.paySectionHeading}>
          {labels.paymentDetails}
        </LookText>
        {transfer ? (
          <LookBox style={{ ...styles.kvBlock, ...styles.paymentDetailKv }}>
            <DomPaymentKv
              first
              ariaLabel={labels.bankAccount}
              k={labels.bankAccount}
              onChange={
                onEdit
                  ? (value) =>
                      onEdit({ type: "bank", field: "accountNumber", value })
                  : undefined
              }
              placeholder={placeholders.account}
              styles={styles}
              v={transfer.accountNumber}
            />
            <DomPaymentKv
              ariaLabel="IBAN"
              k="IBAN"
              onChange={
                onEdit
                  ? (value) => onEdit({ type: "bank", field: "iban", value })
                  : undefined
              }
              placeholder={placeholders.iban}
              styles={styles}
              v={onEdit ? transfer.iban : formatIbanDisplay(transfer.iban)}
            />
            {transfer.bic ? (
              <DomPaymentKv k="SWIFT / BIC" styles={styles} v={transfer.bic} />
            ) : null}
            {inv.payment.variableSymbol ? (
              <DomPaymentKv
                k={labels.variableSymbol}
                styles={styles}
                v={inv.payment.variableSymbol}
              />
            ) : null}
            <DomPaymentKv
              k={labels.paymentMethod}
              styles={styles}
              v={paymentMethodLabel(inv.payment.method, labels)}
            />
          </LookBox>
        ) : inv.payment.method === "cash" ? (
          <LookText style={styles.payMethodTxt}>{labels.payCash}</LookText>
        ) : (
          <LookText style={styles.payMethodTxt}>{labels.payCard}</LookText>
        )}
      </LookBox>
      {instructionsAfter ? (
        <LookBox style={styles.paymentInstructionsAfter}>
          {markdown(instructionsAfter, styles)}
        </LookBox>
      ) : null}
    </LookBox>
  );
}

export function renderQr(ctx: LookDomCtx): React.ReactElement | null {
  if (!ctx.look.theme.showQr || !ctx.assets.qrDataUrl) return null;
  const qrBox = cssFromLookBox(ctx.styles.qr);
  return (
    <LookBox lookBlock="qr">
      <img
        alt=""
        src={ctx.assets.qrDataUrl}
        style={{
          width: qrBox.width,
          height: qrBox.height,
          flexShrink: 0,
        }}
      />
      <LookText style={ctx.styles.paymentHint}>{ctx.labels.qrHint}</LookText>
    </LookBox>
  );
}
