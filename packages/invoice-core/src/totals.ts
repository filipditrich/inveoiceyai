import type { z } from "zod";
import {
  InvoiceItemSchema,
  InvoiceVatSchema,
  TotalsSchema,
  VatRateSchema,
} from "./schema";

type InvoiceVat = z.infer<typeof InvoiceVatSchema>;
type ItemOut = z.infer<typeof InvoiceItemSchema>;
type TotalsOut = z.infer<typeof TotalsSchema>;
export type VatLineRate = z.infer<typeof VatRateSchema>;

/** Round to 2 decimals (half away from zero via `Math.round`). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert a VAT-inclusive unit price to exclusive storage.
 * Uses `exclusive = round2(inclusive / (1 + rate/100))`; rate 0 leaves the amount unchanged (aside from rounding).
 */
export function exclusiveUnitPriceFromInclusive(
  inclusive: number,
  vatRatePercent: number,
): number {
  if (!(vatRatePercent > 0)) {
    return round2(inclusive);
  }
  return round2(inclusive / (1 + vatRatePercent / 100));
}

export interface CalcTotalsLineInput {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: VatLineRate;
}

function effectiveVatRate(
  line: CalcTotalsLineInput,
  vat: InvoiceVat,
  issuerVatPayer: boolean,
): number {
  if (!issuerVatPayer) {
    return 0;
  }
  if (vat.mode === "reverse_charge") {
    return 0;
  }
  return line.vatRate;
}

interface WorkingRow extends CalcTotalsLineInput {
  _effectiveRate: number;
  lineSubtotal: number;
  lineVat: number;
  lineTotal?: number;
}

/**
 * Computes line amounts and invoice totals. VAT breakdown uses per-rate aggregation:
 * base = sum of line subtotals for that rate, VAT = round2(base × rate / 100).
 * Per-line VAT is adjusted when the sum of rounded line VATs differs from the bucket (last line in group absorbs diff).
 */
export function calcTotals(
  items: CalcTotalsLineInput[],
  vat: InvoiceVat,
  issuerVatPayer: boolean,
): { items: ItemOut[]; totals: TotalsOut } {
  const working: WorkingRow[] = items.map((line) => {
    const rate = effectiveVatRate(line, vat, issuerVatPayer);
    const lineSubtotal = round2(line.quantity * line.unitPriceWithoutVat);
    const lineVatRaw = round2((lineSubtotal * rate) / 100);
    return {
      ...line,
      _effectiveRate: rate,
      lineSubtotal,
      lineVat: lineVatRaw,
    };
  });

  const byRate = new Map<number, WorkingRow[]>();
  for (const row of working) {
    const r = row._effectiveRate;
    const list = byRate.get(r) ?? [];
    list.push(row);
    byRate.set(r, list);
  }

  const vatBreakdown: TotalsOut["vatBreakdown"] = [];

  for (const [rate, rows] of [...byRate.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const base = round2(rows.reduce((s, r) => s + r.lineSubtotal, 0));
    const bucketVat = round2((base * rate) / 100);
    const sumLineVat = round2(rows.reduce((s, r) => s + r.lineVat, 0));
    const diff = round2(bucketVat - sumLineVat);
    if (diff !== 0 && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      last.lineVat = round2(last.lineVat + diff);
    }
    for (const r of rows) {
      r.lineTotal = round2(r.lineSubtotal + r.lineVat);
    }
    vatBreakdown.push({ rate, base, vat: bucketVat });
  }

  const resultItems: ItemOut[] = working.map((w) => ({
    position: w.position,
    description: w.description,
    quantity: w.quantity,
    unit: w.unit,
    unitPriceWithoutVat: w.unitPriceWithoutVat,
    vatRate: w.vatRate,
    lineSubtotal: w.lineSubtotal,
    lineVat: w.lineVat,
    lineTotal: w.lineTotal ?? round2(w.lineSubtotal + w.lineVat),
  }));

  const subtotal = round2(working.reduce((s, w) => s + w.lineSubtotal, 0));
  const vatTotal = round2(vatBreakdown.reduce((s, b) => s + b.vat, 0));
  const total = round2(subtotal + vatTotal);

  return {
    items: resultItems,
    totals: {
      subtotal,
      vatBreakdown,
      vatTotal,
      total,
    },
  };
}
