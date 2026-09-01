import {
  InvoiceCurrencySchema,
  InvoiceLanguageSchema,
  InvoiceSchema,
  type ClientSnapshot,
  type Invoice,
  type InvoiceCurrency,
  type InvoiceLanguage,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import {
  calcTotals,
  exclusiveUnitPriceFromInclusive,
} from "@invoicey/invoice-core/totals";

export type BuilderLineInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number;
};

export type BuilderInvoiceInput = {
  docType: Invoice["meta"]["docType"];
  number: string;
  issueDate: string;
  dueDate: string;
  duzp: string;
  currency?: InvoiceCurrency;
  language?: InvoiceLanguage;
  issuer: IssuerSnapshot;
  client: ClientSnapshot;
  vatMode: Invoice["vat"]["mode"];
  suppliesAbroad: Invoice["vat"]["suppliesAbroad"];
  legalNote?: string;
  localReverseChargeCode?: string;
  items: BuilderLineInput[];
  notes?: string;
  correctedInvoiceNumber?: string;
  paymentMethod?: Invoice["payment"]["method"];
  pricesIncludeVat?: boolean;
  look?: Invoice["look"];
  lookSnapshot?: Invoice["lookSnapshot"];
  appearance?: Invoice["appearance"];
  issuedBy?: Invoice["meta"]["issuedBy"];
};

/** Effective rates + optional inclusive→exclusive before build/persist. */
export function prepareBuilderLines(
  items: BuilderLineInput[],
  opts: {
    pricesIncludeVat: boolean;
    vatMode: Invoice["vat"]["mode"];
    issuerVatPayer: boolean;
  },
): BuilderLineInput[] {
  return items.map((line) => {
    const forceZero = !opts.issuerVatPayer || opts.vatMode === "reverse_charge";
    const vatRate = forceZero ? 0 : line.vatRate;
    const conversionRate = forceZero ? 0 : line.vatRate;
    const unitPriceWithoutVat = opts.pricesIncludeVat
      ? exclusiveUnitPriceFromInclusive(
          line.unitPriceWithoutVat,
          conversionRate,
        )
      : line.unitPriceWithoutVat;
    return {
      ...line,
      unitPriceWithoutVat,
      vatRate,
    };
  });
}

/** Assemble a Zod-validatable Invoice (or draft with provisional number). */
export function buildInvoicePayload(input: BuilderInvoiceInput): Invoice {
  const vatMode = input.issuer.vatPayer ? input.vatMode : "regular";
  const lines = prepareBuilderLines(input.items, {
    pricesIncludeVat: Boolean(input.pricesIncludeVat),
    vatMode,
    issuerVatPayer: input.issuer.vatPayer,
  });

  const { items, totals } = calcTotals(
    lines.map((line, i) => ({
      position: i + 1,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceWithoutVat: line.unitPriceWithoutVat,
      vatRate: line.vatRate,
    })),
    {
      mode: vatMode,
      suppliesAbroad: input.suppliesAbroad,
      ...(input.legalNote ? { legalNote: input.legalNote } : {}),
      ...(input.localReverseChargeCode
        ? { localReverseChargeCode: input.localReverseChargeCode }
        : {}),
    },
    input.issuer.vatPayer,
  );

  const method = input.paymentMethod ?? "transfer";
  const variableSymbol = digitsOnly(input.number).slice(0, 10);
  const payment =
    method === "transfer"
      ? {
          method: "transfer" as const,
          bankAccount: input.issuer.bank,
          ...(variableSymbol ? { variableSymbol } : {}),
        }
      : { method };

  const candidate = {
    meta: {
      docType: input.docType,
      number: input.number,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      duzp: input.duzp,
      language: InvoiceLanguageSchema.parse(input.language ?? "cs"),
      currency: InvoiceCurrencySchema.parse(input.currency ?? "CZK"),
      ...(input.docType === "credit_note" && input.correctedInvoiceNumber
        ? { correctedInvoiceNumber: input.correctedInvoiceNumber }
        : {}),
      ...(input.issuedBy ? { issuedBy: input.issuedBy } : {}),
    },
    issuer: input.issuer,
    client: input.client,
    vat: {
      mode: vatMode,
      suppliesAbroad: input.suppliesAbroad,
      ...(input.legalNote ? { legalNote: input.legalNote } : {}),
      ...(input.localReverseChargeCode
        ? { localReverseChargeCode: input.localReverseChargeCode }
        : {}),
    },
    payment,
    items,
    totals,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.look ? { look: input.look } : {}),
    ...(input.lookSnapshot ? { lookSnapshot: input.lookSnapshot } : {}),
    ...(input.appearance ? { appearance: input.appearance } : {}),
  };

  return InvoiceSchema.parse(candidate);
}

export function tryBuildInvoicePayload(
  input: BuilderInvoiceInput,
): { ok: true; invoice: Invoice } | { ok: false; message: string } {
  try {
    return { ok: true, invoice: buildInvoicePayload(input) };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "invoice build failed",
    };
  }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `from` to `to` (ISO dates). Invalid input → 0. */
export function diffDaysIso(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00.000Z`);
  const end = Date.parse(`${to}T12:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000);
}
