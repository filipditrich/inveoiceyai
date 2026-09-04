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
import type { LookPartyField, LookPartySide } from "./edits";
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
            placeholder="20260001"
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

function partyPatch(ctx: LookDomCtx, side: LookPartySide) {
  if (!ctx.onEdit) return undefined;
  return (field: LookPartyField) => (value: string) =>
    ctx.onEdit?.({ type: "party", side, field, value });
}

function EditPartyBlock({
  ctx,
  side,
  title,
  name,
  street,
  city,
  zip,
  country,
  ico,
  dic,
  email,
  registryNote,
  showDic,
  nonVatLabel,
}: {
  ctx: LookDomCtx;
  side: LookPartySide;
  title: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  ico: string;
  dic: string;
  email: string;
  registryNote?: string;
  showDic: boolean;
  nonVatLabel?: string;
}) {
  const { labels, styles, placeholders } = ctx;
  const [open, setOpen] = React.useState(false);
  const patch = partyPatch(ctx, side);
  return (
    <>
      <LookBox style={styles.sectionHairShort} />
      <LookText style={styles.sectionCaps}>{title}</LookText>
      <LookBox style={styles.kvBlock}>
        <DomKv
          first
          ariaLabel={labels.ico}
          k={labels.ico}
          onChange={patch?.("ico")}
          placeholder={placeholders.ico}
          styles={styles}
          v={ico}
        />
      </LookBox>
      {ico.length === 0 ? (
        <LookText extra={{ marginTop: 2 }} style={styles.kvKey}>
          {placeholders.icoHint}
        </LookText>
      ) : null}
      <LookField
        ariaLabel={title}
        onChange={patch?.("name")}
        placeholder={placeholders.name}
        style={styles.partyName}
        value={name}
      />
      <button
        onClick={() => setOpen((current) => !current)}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          color: styles.kvKey.color,
          cursor: "pointer",
          fontSize: "7.5pt",
          marginTop: 4,
          padding: 0,
          textAlign: "left",
        }}
        type="button"
      >
        {open ? placeholders.hideDetails : placeholders.details}
      </button>
      {open ? (
        <>
          <LookField
            ariaLabel={placeholders.street}
            onChange={patch?.("street")}
            placeholder={placeholders.street}
            style={styles.partyAddr}
            value={street}
          />
          <LookBox extra={{ flexDirection: "row", gap: 4 }}>
            <LookField
              ariaLabel={placeholders.zip}
              extra={{ width: "auto" }}
              onChange={patch?.("zip")}
              placeholder={placeholders.zip}
              style={styles.partyAddrTight}
              value={zip}
            />
            <LookField
              ariaLabel={placeholders.city}
              onChange={patch?.("city")}
              placeholder={placeholders.city}
              style={styles.partyAddrTight}
              value={city}
            />
          </LookBox>
          <LookText style={styles.partyAddrTight}>{country}</LookText>
          <LookBox style={styles.kvBlock}>
            {showDic ? (
              <DomKv
                first
                ariaLabel={labels.dic}
                k={labels.dic}
                onChange={patch?.("dic")}
                placeholder={placeholders.dic}
                styles={styles}
                v={dic}
              />
            ) : null}
            {nonVatLabel ? (
              <DomKv
                first={!showDic}
                k={labels.vat}
                styles={styles}
                v={nonVatLabel}
              />
            ) : null}
            <DomKv
              first={!showDic && !nonVatLabel}
              ariaLabel={labels.contactEmail}
              k={labels.contactEmail}
              onChange={patch?.("contactEmail")}
              placeholder={placeholders.email}
              styles={styles}
              v={email}
            />
          </LookBox>
          {registryNote !== undefined ? (
            <LookField
              ariaLabel="registry"
              onChange={patch?.("registryNote")}
              style={styles.registryNote}
              value={registryNote}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function ViewIssuer(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles } = ctx;
  return (
    <LookBox lookBlock="issuer">
      <LookBox style={styles.sectionHairShort} />
      <LookText style={styles.sectionCaps}>{labels.supplier}</LookText>
      <LookText style={styles.partyName}>{inv.issuer.name}</LookText>
      <LookText style={styles.partyAddr}>{inv.issuer.address.street}</LookText>
      <LookBox extra={{ flexDirection: "row", gap: 4 }}>
        <LookText extra={{ width: "auto" }} style={styles.partyAddrTight}>
          {inv.issuer.address.zip}
        </LookText>
        <LookText style={styles.partyAddrTight}>
          {inv.issuer.address.city}
        </LookText>
      </LookBox>
      <LookText style={styles.partyAddrTight}>
        {countryHuman(inv.issuer.address.country, labels)}
      </LookText>
      <LookBox style={styles.kvBlock}>
        <DomKv first k={labels.ico} styles={styles} v={inv.issuer.ico} />
        {inv.issuer.vatPayer && inv.issuer.dic ? (
          <DomKv k={labels.dic} styles={styles} v={inv.issuer.dic} />
        ) : null}
        {!inv.issuer.vatPayer ? (
          <DomKv k={labels.vat} styles={styles} v={labels.nonVatPayer} />
        ) : null}
        <DomKv
          k={labels.contactEmail}
          styles={styles}
          v={inv.issuer.contactEmail}
        />
      </LookBox>
      {inv.issuer.registryNote ? (
        <LookText style={styles.registryNote}>
          {inv.issuer.registryNote}
        </LookText>
      ) : null}
    </LookBox>
  );
}

function ViewClient(ctx: LookDomCtx): React.ReactElement {
  const { invoice: inv, labels, styles } = ctx;
  const showIds =
    Boolean(inv.client.ico) ||
    Boolean(inv.client.dic) ||
    Boolean(inv.client.contactEmail);
  return (
    <LookBox lookBlock="client">
      <LookBox style={styles.sectionHairShort} />
      <LookText style={styles.sectionCaps}>{labels.customer}</LookText>
      <LookText style={styles.partyName}>{inv.client.name}</LookText>
      <LookText style={styles.partyAddr}>{inv.client.address.street}</LookText>
      <LookBox extra={{ flexDirection: "row", gap: 4 }}>
        <LookText extra={{ width: "auto" }} style={styles.partyAddrTight}>
          {inv.client.address.zip}
        </LookText>
        <LookText style={styles.partyAddrTight}>
          {inv.client.address.city}
        </LookText>
      </LookBox>
      <LookText style={styles.partyAddrTight}>
        {countryHuman(inv.client.address.country, labels)}
      </LookText>
      {showIds ? (
        <LookBox style={styles.kvBlock}>
          {inv.client.ico ? (
            <DomKv first k={labels.ico} styles={styles} v={inv.client.ico} />
          ) : null}
          {inv.client.dic ? (
            <DomKv k={labels.dic} styles={styles} v={inv.client.dic} />
          ) : null}
          {inv.client.contactEmail ? (
            <DomKv
              k={labels.contactEmail}
              styles={styles}
              v={inv.client.contactEmail}
            />
          ) : null}
        </LookBox>
      ) : null}
    </LookBox>
  );
}

export function renderIssuer(ctx: LookDomCtx): React.ReactElement {
  if (!ctx.onEdit) return ViewIssuer(ctx);
  const { invoice: inv, labels } = ctx;
  return (
    <LookBox lookBlock="issuer">
      <EditPartyBlock
        city={inv.issuer.address.city}
        country={countryHuman(inv.issuer.address.country, labels)}
        ctx={ctx}
        dic={inv.issuer.dic ?? ""}
        email={inv.issuer.contactEmail}
        ico={inv.issuer.ico}
        name={inv.issuer.name}
        nonVatLabel={inv.issuer.vatPayer ? undefined : labels.nonVatPayer}
        registryNote={inv.issuer.registryNote ?? ""}
        showDic={inv.issuer.vatPayer}
        side="issuer"
        street={inv.issuer.address.street}
        title={labels.supplier}
        zip={inv.issuer.address.zip}
      />
    </LookBox>
  );
}

export function renderClient(ctx: LookDomCtx): React.ReactElement {
  if (!ctx.onEdit) return ViewClient(ctx);
  const { invoice: inv, labels } = ctx;
  return (
    <LookBox lookBlock="client">
      <EditPartyBlock
        city={inv.client.address.city}
        country={countryHuman(inv.client.address.country, labels)}
        ctx={ctx}
        dic={inv.client.dic ?? ""}
        email={inv.client.contactEmail ?? ""}
        ico={inv.client.ico ?? ""}
        name={inv.client.name}
        showDic
        side="client"
        street={inv.client.address.street}
        title={labels.customer}
        zip={inv.client.address.zip}
      />
    </LookBox>
  );
}
