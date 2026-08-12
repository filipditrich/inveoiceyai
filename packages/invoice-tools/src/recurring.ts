import { calcTotals } from "@invoicey/invoice-core";
import {
  InvoiceSchema,
  type ClientSnapshot,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { z } from "zod";

export const RecurringCadenceSchema = z.enum(["monthly", "quarterly"]);
export type RecurringCadence = z.infer<typeof RecurringCadenceSchema>;

export const RecurringDayOfMonthSchema = z.number().int().min(1).max(28);

const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

/** Inclusive calendar days from issue to due (never negative). */
export function paymentDueDays(issueDate: string, dueDate: string): number {
  const issue = Date.parse(`${issueDate}T12:00:00.000Z`);
  const due = Date.parse(`${dueDate}T12:00:00.000Z`);
  if (Number.isNaN(issue) || Number.isNaN(due)) {
    return 0;
  }
  return Math.max(0, Math.round((due - issue) / MS_PER_DAY));
}

/** Next `dayOfMonth` on or after `minYmd` (1–28, so every month is valid). */
export function nextOccurrenceOnOrAfter(
  minYmd: string,
  dayOfMonth: number,
): string {
  const { year, month } = parseYmd(minYmd);
  const candidate = ymd(year, month, dayOfMonth);
  if (candidate >= minYmd) {
    return candidate;
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return ymd(nextYear, nextMonth, dayOfMonth);
}

export function addCadence(
  fromYmd: string,
  cadence: RecurringCadence,
  dayOfMonth: number,
): string {
  let months: number;
  switch (cadence) {
    case "monthly":
      months = 1;
      break;
    case "quarterly":
      months = 3;
      break;
    default: {
      const _exhaustive: never = cadence;
      return _exhaustive;
    }
  }
  const { year, month } = parseYmd(fromYmd);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return ymd(nextYear, nextMonth, dayOfMonth);
}

/** After creating a draft for `nextRunOn`, jump to the next future occurrence. */
export function advanceNextRunUntilFuture(
  nextRunOn: string,
  todayIso: string,
  cadence: RecurringCadence,
  dayOfMonth: number,
): string {
  let next = addCadence(nextRunOn, cadence, dayOfMonth);
  while (next <= todayIso) {
    next = addCadence(next, cadence, dayOfMonth);
  }
  return next;
}

export function addCalendarDaysYmd(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T12:00:00.000Z`);
  const bumped = new Date(base + days * MS_PER_DAY);
  return ymd(
    bumped.getUTCFullYear(),
    bumped.getUTCMonth() + 1,
    bumped.getUTCDate(),
  );
}

export function tomorrowIso(todayIso: string): string {
  return addCalendarDaysYmd(todayIso, 1);
}

export function defaultNextRunOn(todayIso: string, dayOfMonth: number): string {
  return nextOccurrenceOnOrAfter(tomorrowIso(todayIso), dayOfMonth);
}

export function buildRecurringDraft(input: {
  template: Invoice;
  issuer: IssuerSnapshot;
  client: ClientSnapshot;
  todayIso: string;
  paymentDueDays: number;
}): { ok: true; invoice: Invoice } | { ok: false; error: string } {
  const vatPayer = input.issuer.vatPayer;
  const vat = vatPayer
    ? input.template.vat
    : { ...input.template.vat, mode: "regular" as const };
  const lineInputs = input.template.items.map((line) => ({
    position: line.position,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceWithoutVat: line.unitPriceWithoutVat,
    vatRate: vatPayer ? line.vatRate : 0,
  }));
  const computed = calcTotals(lineInputs, vat, vatPayer);
  const dueDate = addCalendarDaysYmd(input.todayIso, input.paymentDueDays);
  const payment = paymentForRecurringDraft(
    input.template.payment,
    input.issuer,
  );

  const parsed = InvoiceSchema.safeParse({
    ...input.template,
    meta: {
      ...input.template.meta,
      docType: "invoice",
      number: "DRAFT",
      issueDate: input.todayIso,
      dueDate,
      duzp: input.todayIso,
    },
    issuer: input.issuer,
    client: input.client,
    vat,
    payment,
    items: computed.items,
    totals: computed.totals,
  });
  if (!parsed.success) {
    return { ok: false, error: "invalid_payload" };
  }
  return { ok: true, invoice: parsed.data };
}

/** Digits of an invoice number, suitable as a Czech variable symbol. */
export function variableSymbolFromNumber(number: string): string | undefined {
  const digits = number.replace(/\D/g, "").slice(0, 10);
  return digits.length > 0 ? digits : undefined;
}

function paymentForRecurringDraft(
  payment: Invoice["payment"],
  issuer: IssuerSnapshot,
): Invoice["payment"] {
  const next = { ...payment };
  delete next.variableSymbol;
  if (next.method === "transfer") {
    return { ...next, bankAccount: issuer.bank };
  }
  return next;
}
