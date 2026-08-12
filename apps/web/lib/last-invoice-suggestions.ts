import { diffDaysIso, type BuilderLineInput } from "@/lib/build-invoice";
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceLanguage,
} from "@invoicey/invoice-core/schema";

export type LastInvoiceLineSuggestion = BuilderLineInput;

export type LastInvoiceSuggestions = {
  number: string | null;
  dueDays: number;
  currency: InvoiceCurrency;
  language: InvoiceLanguage;
  vatMode: Invoice["vat"]["mode"];
  suppliesAbroad: Invoice["vat"]["suppliesAbroad"];
  legalNote: string | null;
  localReverseChargeCode: string | null;
  notes: string | null;
  items: LastInvoiceLineSuggestion[];
};

type SuggestionSource = {
  meta: Pick<
    Invoice["meta"],
    "number" | "issueDate" | "dueDate" | "currency" | "language"
  >;
  vat: Pick<
    Invoice["vat"],
    "mode" | "suppliesAbroad" | "legalNote" | "localReverseChargeCode"
  >;
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceWithoutVat: number;
    vatRate: number;
  }>;
};

export function suggestionsFromInvoice(
  invoice: SuggestionSource,
): LastInvoiceSuggestions {
  const legalNote = invoice.vat.legalNote?.trim() ?? "";
  const reverseCode = invoice.vat.localReverseChargeCode?.trim() ?? "";
  const notes = invoice.notes?.trim() ?? "";
  return {
    number: invoice.meta.number,
    dueDays: Math.max(
      0,
      diffDaysIso(invoice.meta.issueDate, invoice.meta.dueDate),
    ),
    currency: invoice.meta.currency,
    language: invoice.meta.language,
    vatMode: invoice.vat.mode,
    suppliesAbroad: invoice.vat.suppliesAbroad,
    legalNote: legalNote.length > 0 ? legalNote : null,
    localReverseChargeCode: reverseCode.length > 0 ? reverseCode : null,
    notes: notes.length > 0 ? notes : null,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceWithoutVat: item.unitPriceWithoutVat,
      vatRate: item.vatRate,
    })),
  };
}

export function truncateHint(value: string, max = 42): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
