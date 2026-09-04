import React from "react";

import { lookHasBlock } from "../looks";
import {
  countryHuman,
  formatInvoiceDateIsoLocal,
} from "../looks/format-invoice";
import type { LookStyleBox } from "../looks/style-ir";
import {
  invoicePdfDocKindSubtitle,
  invoicePdfMainTitle,
  invoicePdfTaxPointLabel,
} from "../pdf/pdf-presentation";
import { LookBox, LookField, LookText } from "./field";
import { DomKv } from "./kv";
import type { LookDomCtx } from "./types";

function dateFields(ctx: LookDomCtx, boxStyle: LookStyleBox) {
  const { invoice: inv, labels, intlLocale, styles, onEdit } = ctx;
  const showDuzp =
    inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";
  return (
    <LookBox style={boxStyle}>
      <DomKv
        first
        ariaLabel={labels.issueDate}
        k={labels.issueDate}
        onChange={
          onEdit
            ? (value) => onEdit({ type: "meta", field: "issueDate", value })
            : undefined
        }
        styles={styles}
        type="date"
        v={
          onEdit
            ? inv.meta.issueDate
            : formatInvoiceDateIsoLocal(inv.meta.issueDate, intlLocale)
        }
      />
      <DomKv
        ariaLabel={labels.dueDate}
        k={labels.dueDate}
        onChange={
          onEdit
            ? (value) => onEdit({ type: "meta", field: "dueDate", value })
            : undefined
        }
        styles={styles}
        type="date"
        v={
          onEdit
            ? inv.meta.dueDate
            : formatInvoiceDateIsoLocal(inv.meta.dueDate, intlLocale)
        }
      />
      {showDuzp ? (
        <DomKv
          ariaLabel={invoicePdfTaxPointLabel(inv, labels)}
          k={invoicePdfTaxPointLabel(inv, labels)}
          onChange={
            onEdit
              ? (value) => onEdit({ type: "meta", field: "duzp", value })
              : undefined
          }
          styles={styles}
          type="date"
          v={
            onEdit
              ? inv.meta.duzp
              : formatInvoiceDateIsoLocal(inv.meta.duzp, intlLocale)
          }
        />
      ) : null}
    </LookBox>
  );
}

export function renderTitle(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles, look, onEdit } = ctx;
  const subtitle = invoicePdfDocKindSubtitle(inv, labels);
  const titlePrefix = invoicePdfMainTitle(
    { ...inv, meta: { ...inv.meta, number: "" } },
    labels,
  ).trim();
  return (
    <LookBox lookBlock="title">
      <LookBox style={styles.titleColRule} />
      {onEdit ? (
        <LookBox
          extra={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
        >
          <LookText style={styles.invoiceTitle}>{titlePrefix}</LookText>
          <LookField
            ariaLabel={labels.docNo}
            onChange={(value) =>
              onEdit({ type: "meta", field: "number", value })
            }
            style={styles.invoiceTitle}
            value={inv.meta.number}
          />
        </LookBox>
      ) : (
        <LookText style={styles.invoiceTitle}>
          {invoicePdfMainTitle(inv, labels)}
        </LookText>
      )}
      {subtitle ? (
        <LookText style={styles.docKindMicro}>{subtitle}</LookText>
      ) : null}
      {lookHasBlock(look, "dates") ? null : dateFields(ctx, styles.kvBlock)}
    </LookBox>
  );
}

export function renderDates(ctx: LookDomCtx): React.ReactElement {
  return (
    <LookBox lookBlock="dates">{dateFields(ctx, ctx.styles.partyMeta)}</LookBox>
  );
}

export function renderIssuer(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles, onEdit } = ctx;
  const side = "issuer" as const;
  const patch = onEdit
    ? (
        field:
          | "name"
          | "street"
          | "city"
          | "zip"
          | "country"
          | "ico"
          | "dic"
          | "contactEmail"
          | "registryNote",
      ) =>
        (value: string) =>
          onEdit({ type: "party", side, field, value })
    : undefined;
  return (
    <LookBox lookBlock="issuer">
      <LookBox style={styles.sectionHairShort} />
      <LookText style={styles.sectionCaps}>{labels.supplier}</LookText>
      <LookField
        ariaLabel={labels.supplier}
        onChange={patch?.("name")}
        style={styles.partyName}
        value={inv.issuer.name}
      />
      <LookField
        ariaLabel={labels.supplier}
        onChange={patch?.("street")}
        style={styles.partyAddr}
        value={inv.issuer.address.street}
      />
      <LookBox extra={{ flexDirection: "row", gap: 4 }}>
        <LookField
          ariaLabel="ZIP"
          extra={{ width: "auto" }}
          onChange={patch?.("zip")}
          style={styles.partyAddrTight}
          value={inv.issuer.address.zip}
        />
        <LookField
          ariaLabel="city"
          onChange={patch?.("city")}
          style={styles.partyAddrTight}
          value={inv.issuer.address.city}
        />
      </LookBox>
      <LookText style={styles.partyAddrTight}>
        {countryHuman(inv.issuer.address.country, labels)}
      </LookText>
      <LookBox style={styles.kvBlock}>
        <DomKv
          first
          ariaLabel={labels.ico}
          k={labels.ico}
          onChange={patch?.("ico")}
          styles={styles}
          v={inv.issuer.ico}
        />
        {inv.issuer.vatPayer && (inv.issuer.dic || onEdit) ? (
          <DomKv
            ariaLabel={labels.dic}
            k={labels.dic}
            onChange={patch?.("dic")}
            styles={styles}
            v={inv.issuer.dic ?? ""}
          />
        ) : null}
        {!inv.issuer.vatPayer ? (
          <DomKv k={labels.vat} styles={styles} v={labels.nonVatPayer} />
        ) : null}
        <DomKv
          ariaLabel={labels.contactEmail}
          k={labels.contactEmail}
          onChange={patch?.("contactEmail")}
          styles={styles}
          v={inv.issuer.contactEmail}
        />
      </LookBox>
      {inv.issuer.registryNote ? (
        <LookField
          ariaLabel="registry"
          onChange={patch?.("registryNote")}
          style={styles.registryNote}
          value={inv.issuer.registryNote}
        />
      ) : null}
    </LookBox>
  );
}

export function renderClient(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles, onEdit } = ctx;
  const patch = onEdit
    ? (
        field:
          | "name"
          | "street"
          | "city"
          | "zip"
          | "ico"
          | "dic"
          | "contactEmail",
      ) =>
        (value: string) =>
          onEdit({ type: "party", side: "client", field, value })
    : undefined;
  const showIds =
    Boolean(inv.client.ico) ||
    Boolean(inv.client.dic) ||
    Boolean(inv.client.contactEmail) ||
    Boolean(onEdit);
  return (
    <LookBox lookBlock="client">
      <LookBox style={styles.sectionHairShort} />
      <LookText style={styles.sectionCaps}>{labels.customer}</LookText>
      <LookField
        ariaLabel={labels.customer}
        onChange={patch?.("name")}
        style={styles.partyName}
        value={inv.client.name}
      />
      <LookField
        ariaLabel={labels.customer}
        onChange={patch?.("street")}
        style={styles.partyAddr}
        value={inv.client.address.street}
      />
      <LookBox extra={{ flexDirection: "row", gap: 4 }}>
        <LookField
          ariaLabel="ZIP"
          extra={{ width: "auto" }}
          onChange={patch?.("zip")}
          style={styles.partyAddrTight}
          value={inv.client.address.zip}
        />
        <LookField
          ariaLabel="city"
          onChange={patch?.("city")}
          style={styles.partyAddrTight}
          value={inv.client.address.city}
        />
      </LookBox>
      <LookText style={styles.partyAddrTight}>
        {countryHuman(inv.client.address.country, labels)}
      </LookText>
      {showIds ? (
        <LookBox style={styles.kvBlock}>
          <DomKv
            first
            ariaLabel={labels.ico}
            k={labels.ico}
            onChange={patch?.("ico")}
            styles={styles}
            v={inv.client.ico ?? ""}
          />
          <DomKv
            ariaLabel={labels.dic}
            k={labels.dic}
            onChange={patch?.("dic")}
            styles={styles}
            v={inv.client.dic ?? ""}
          />
          <DomKv
            ariaLabel={labels.contactEmail}
            k={labels.contactEmail}
            onChange={patch?.("contactEmail")}
            styles={styles}
            v={inv.client.contactEmail ?? ""}
          />
        </LookBox>
      ) : null}
    </LookBox>
  );
}
