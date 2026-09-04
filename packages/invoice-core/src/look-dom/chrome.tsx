import React from "react";

import { issuedByFooterLine } from "../labels";
import { cssFromLookText } from "./css";
import { LookBox, LookText } from "./field";
import type { LookDomCtx } from "./types";

const INVOICEY_SITE_URL = "https://invoicey.app/";

export function renderLogo(ctx: LookDomCtx): React.ReactElement | null {
  if (!ctx.assets.logoUrl) return null;
  return (
    <LookBox lookBlock="logo">
      <img
        alt=""
        src={ctx.assets.logoUrl}
        style={{
          maxHeight: ctx.look.theme.logoMaxHeightPt,
          width: 140,
          objectFit: "contain",
          objectPosition: "left top",
        }}
      />
    </LookBox>
  );
}

export function renderStamp(ctx: LookDomCtx): React.ReactElement | null {
  if (!ctx.look.theme.showStamp || !ctx.assets.stampUrl) return null;
  const image = (
    <img
      alt=""
      src={ctx.assets.stampUrl}
      style={{
        width: ctx.look.theme.stampMaxHeightPt,
        height: ctx.look.theme.stampMaxHeightPt,
        objectFit: "contain",
        objectPosition: "bottom",
      }}
    />
  );
  if (ctx.column !== "end") {
    return <LookBox lookBlock="stamp">{image}</LookBox>;
  }
  return (
    <LookBox lookBlock="stamp" style={ctx.styles.stampWrapEnd}>
      {image}
    </LookBox>
  );
}

export function renderSignature(ctx: LookDomCtx): React.ReactElement | null {
  if (!ctx.look.theme.showSignature || !ctx.assets.signatureUrl) return null;
  return (
    <LookBox lookBlock="signature">
      <img
        alt=""
        src={ctx.assets.signatureUrl}
        style={{
          width: 140,
          height: 52,
          objectFit: "contain",
          objectPosition: "bottom",
        }}
      />
    </LookBox>
  );
}

export function renderFooter(ctx: LookDomCtx): React.ReactElement {
  const issuedBy = ctx.invoice.meta.issuedBy;
  const issuedByLine = issuedBy
    ? issuedByFooterLine(ctx.invoice.meta.language, issuedBy)
    : null;
  return (
    <LookBox
      extra={issuedByLine ? { justifyContent: "space-between" } : undefined}
      lookBlock="footer"
      style={ctx.styles.footerRow}
    >
      {issuedByLine ? (
        <LookText style={ctx.styles.footerIssuedBy}>{issuedByLine}</LookText>
      ) : null}
      <a
        href={INVOICEY_SITE_URL}
        style={cssFromLookText(ctx.styles.footerBrand)}
      >
        {ctx.labels.issuedVia}{" "}
        <LookText style={ctx.styles.footerBrandStrong}>Invoicey</LookText>
      </a>
    </LookBox>
  );
}
