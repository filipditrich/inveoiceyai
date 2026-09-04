import type { ReactElement } from "react";

import type { LookBlockHandlers } from "../looks/block-coverage";
import {
  renderLogo,
  renderStamp,
  renderSignature,
  renderFooter,
} from "./chrome";
import { renderLines, renderNotes, renderTax, renderTotals } from "./lines";
import { renderClient, renderDates, renderIssuer, renderTitle } from "./party";
import { renderPayment, renderQr } from "./payment";
import type { LookDomCtx } from "./types";

export const DOM_LOOK_BLOCK_HANDLERS: LookBlockHandlers<
  LookDomCtx,
  ReactElement
> = {
  logo: (ctx) => renderLogo(ctx),
  title: (ctx) => renderTitle(ctx),
  issuer: (ctx) => renderIssuer(ctx),
  client: (ctx) => renderClient(ctx),
  dates: (ctx) => renderDates(ctx),
  payment: (ctx, slot) => renderPayment(ctx, slot.variant === "compact"),
  qr: (ctx) => renderQr(ctx),
  lines: (ctx) => renderLines(ctx),
  totals: (ctx) => renderTotals(ctx),
  tax: (ctx) => renderTax(ctx),
  notes: (ctx) => renderNotes(ctx),
  stamp: (ctx) => renderStamp(ctx),
  signature: (ctx) => renderSignature(ctx),
  footer: (ctx) => renderFooter(ctx),
};
