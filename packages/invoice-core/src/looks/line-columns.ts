export const LINE_COLS_WITH_VAT = {
  desc: "42%",
  qty: "15%",
  unitPx: "18%",
  vat: "6%",
  tot: "19%",
} as const;

export const LINE_COLS_NO_VAT = {
  desc: "46%",
  qty: "17%",
  unitPx: "18%",
  tot: "19%",
} as const;

export type LineCols = typeof LINE_COLS_WITH_VAT | typeof LINE_COLS_NO_VAT;

function vatLineCols(cols: LineCols): cols is typeof LINE_COLS_WITH_VAT {
  return Object.hasOwn(cols, "vat");
}

/** CSS grid tracks matching the PDF column percents, clipped so inputs cannot overflow. */
export function lineGridTemplate(cols: LineCols): string {
  const tracks = vatLineCols(cols)
    ? [cols.desc, cols.qty, cols.unitPx, cols.vat, cols.tot]
    : [cols.desc, cols.qty, cols.unitPx, cols.tot];
  return tracks.map((pct) => `minmax(0, ${pct})`).join(" ");
}
