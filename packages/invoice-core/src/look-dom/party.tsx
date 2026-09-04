import React from "react";

import { lookHasBlock } from "../looks";
import { countryHuman } from "../looks/format-invoice";
import type { LookStyleBox } from "../looks/style-ir";
import {
  invoicePdfDocKindSubtitle,
  invoicePdfMainTitle,
  invoicePdfTaxPointLabel,
} from "../pdf/pdf-presentation";
import type { LookPartyField, LookPartySide } from "./edits";
import { LookBox, LookField, LookText } from "./field";
import { DomDateKv, DomKv } from "./kv";
import type { LookDomCtx } from "./types";

function dateFields(ctx: LookDomCtx, boxStyle: LookStyleBox) {
  const { invoice: inv, labels, intlLocale, styles, onEdit } = ctx;
  const showDuzp =
    inv.meta.docType !== "proforma" && inv.meta.docType !== "advance";
  return (
    <LookBox style={boxStyle}>
      <DomDateKv
        first
        ariaLabel={labels.issueDate}
        iso={inv.meta.issueDate}
        k={labels.issueDate}
        locale={intlLocale}
        onChange={
          onEdit
            ? (value) => onEdit({ type: "meta", field: "issueDate", value })
            : undefined
        }
        styles={styles}
      />
      <DomDateKv
        ariaLabel={labels.dueDate}
        iso={inv.meta.dueDate}
        k={labels.dueDate}
        locale={intlLocale}
        onChange={
          onEdit
            ? (value) => onEdit({ type: "meta", field: "dueDate", value })
            : undefined
        }
        styles={styles}
      />
      {showDuzp ? (
        <DomDateKv
          ariaLabel={invoicePdfTaxPointLabel(inv, labels)}
          iso={inv.meta.duzp}
          k={invoicePdfTaxPointLabel(inv, labels)}
          locale={intlLocale}
          onChange={
            onEdit
              ? (value) => onEdit({ type: "meta", field: "duzp", value })
              : undefined
          }
          styles={styles}
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
          extra={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
          }}
        >
          <LookText
            extra={{ whiteSpace: "nowrap", flexShrink: 0 }}
            style={styles.invoiceTitle}
          >
            {titlePrefix}
          </LookText>
          <LookField
            ariaLabel={labels.docNo}
            extra={{
              width: "auto",
              flex: "1 1 auto",
              minWidth: "4ch",
              whiteSpace: "nowrap",
            }}
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

function collapsedPlaceLine(open: boolean, zip: string, city: string): string {
  if (open) return "";
  return [zip, city].filter((part) => part.length > 0).join(" · ");
}

function shouldExpandAfterIcoChange(
  previousIco: string,
  ico: string,
  zip: string,
  city: string,
): boolean {
  if (previousIco === ico) return false;
  return ico.length === 8 && zip.length === 0 && city.length === 0;
}

type PartyPatch = ReturnType<typeof partyPatch>;

function EditPartyDetails({
  ctx,
  patch,
  street,
  city,
  zip,
  country,
  dic,
  email,
  registryNote,
  showDic,
  nonVatLabel,
}: {
  ctx: LookDomCtx;
  patch: PartyPatch;
  street: string;
  city: string;
  zip: string;
  country: string;
  dic: string;
  email: string;
  registryNote?: string;
  showDic: boolean;
  nonVatLabel?: string;
}) {
  const { labels, styles, placeholders } = ctx;
  return (
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
  );
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
  const prevIco = React.useRef(ico);
  const patch = partyPatch(ctx, side);
  const placeSummary = collapsedPlaceLine(open, zip, city);

  React.useEffect(() => {
    if (!shouldExpandAfterIcoChange(prevIco.current, ico, zip, city)) {
      prevIco.current = ico;
      return;
    }
    prevIco.current = ico;
    setOpen(true);
  }, [ico, zip, city]);

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
      {placeSummary.length > 0 ? (
        <LookText extra={{ marginTop: 2 }} style={styles.partyAddrTight}>
          {placeSummary}
        </LookText>
      ) : null}
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
        {`${open ? "▾ " : "▸ "}${open ? placeholders.hideDetails : placeholders.details}`}
      </button>
      {open ? (
        <EditPartyDetails
          city={city}
          country={country}
          ctx={ctx}
          dic={dic}
          email={email}
          nonVatLabel={nonVatLabel}
          patch={patch}
          registryNote={registryNote}
          showDic={showDic}
          street={street}
          zip={zip}
        />
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
