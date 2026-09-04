import React from "react";

import { invoiceLabels, toInvoiceIntlLocale } from "../labels";
import {
  resolveLookDocument,
  validateLookForInvoice,
  type BlockInstance,
  type LookBand,
} from "../looks";
import { createLookStyleIr, rowColumnStyleIr } from "../looks/style-ir";
import type { Invoice } from "../schema";
import { cssFromLookBox } from "./css";
import type { LookEdit } from "./edits";
import { DOM_LOOK_BLOCK_HANDLERS } from "./handlers";
import type { LookDomAssets, LookDomCtx } from "./types";

export function LookDocumentView({
  invoice,
  assets = {},
  onEdit,
}: {
  invoice: Invoice;
  assets?: LookDomAssets;
  onEdit?: (edit: LookEdit) => void;
}) {
  const look = resolveLookDocument(invoice);
  const issues = validateLookForInvoice(look, invoice);
  if (issues.length > 0) {
    throw new Error(`invalid_look: ${issues.map((i) => i.message).join("; ")}`);
  }
  const labels = invoiceLabels(invoice.meta.language);
  const intlLocale = toInvoiceIntlLocale(invoice.meta.language);
  const styles = createLookStyleIr(look.theme);
  const ctx: LookDomCtx = {
    invoice,
    look,
    labels,
    intlLocale,
    styles,
    assets,
    onEdit,
  };

  return (
    <article
      data-look-page={look.id}
      style={cssFromLookBox(styles.page, {
        width: "210mm",
        minHeight: "297mm",
        position: "relative",
        overflow: "hidden",
      })}
    >
      <div style={cssFromLookBox(styles.mainColumn)}>
        {look.layout.bands.map((band, index) => renderBand(ctx, band, index))}
      </div>
      {DOM_LOOK_BLOCK_HANDLERS.footer(ctx, { block: "footer" })}
    </article>
  );
}

function renderSlotColumn(
  ctx: LookDomCtx,
  slots: readonly BlockInstance[],
  column?: "start" | "end",
): React.ReactElement | null {
  const scoped: LookDomCtx = { ...ctx, column };
  const children = slots
    .map((slot, index) => {
      const node = DOM_LOOK_BLOCK_HANDLERS[slot.block](scoped, slot);
      return node ? (
        <div key={`${slot.block}-${String(index)}`}>{node}</div>
      ) : null;
    })
    .filter(Boolean);
  if (children.length === 0) return null;
  return <div>{children}</div>;
}

function renderBand(
  ctx: LookDomCtx,
  band: LookBand,
  index: number,
): React.ReactElement | null {
  if (band.type === "footer") return null;
  if (band.type === "stack") {
    const column = renderSlotColumn(ctx, band.slots);
    if (!column) return null;
    return (
      <div
        key={`band-${String(index)}`}
        style={cssFromLookBox(
          index === 0 ? ctx.styles.colFull : ctx.styles.bandStack,
        )}
      >
        {column}
      </div>
    );
  }
  const start = renderSlotColumn(ctx, band.start, "start");
  const end = renderSlotColumn(ctx, band.end, "end");
  if (!start && !end) return null;
  if (!start) {
    return (
      <div
        key={`band-${String(index)}`}
        style={cssFromLookBox(ctx.styles.colFull)}
      >
        {end}
      </div>
    );
  }
  if (!end) {
    return (
      <div
        key={`band-${String(index)}`}
        style={cssFromLookBox(ctx.styles.colFull)}
      >
        {start}
      </div>
    );
  }
  const rowStyle =
    index === 0
      ? { ...ctx.styles.bandRow, ...ctx.styles.bandRowFirst }
      : ctx.styles.bandRow;
  return (
    <div key={`band-${String(index)}`} style={cssFromLookBox(rowStyle)}>
      <div
        style={cssFromLookBox(
          rowColumnStyleIr(ctx.styles, band.split, "start"),
        )}
      >
        {start}
      </div>
      <div
        style={cssFromLookBox(rowColumnStyleIr(ctx.styles, band.split, "end"))}
      >
        {end}
      </div>
    </div>
  );
}
