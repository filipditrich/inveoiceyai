import type { LookEdit } from "@invoicey/invoice-core/look-dom";
import { parseInvoiceDateInput } from "@invoicey/invoice-core/looks";

import {
  withPrefillNumber,
  withSuggestedIban,
  type GeneratorDraft,
  type GeneratorLine,
  type GeneratorParty,
} from "./draft";

function patchParty(
  party: GeneratorParty,
  field: string,
  value: string,
): GeneratorParty {
  if (field === "name") return { ...party, name: value };
  if (field === "street") return { ...party, street: value };
  if (field === "city") return { ...party, city: value };
  if (field === "zip") return { ...party, zip: value };
  if (field === "country") return { ...party, country: value };
  if (field === "ico")
    return { ...party, ico: value.replace(/\D/gu, "").slice(0, 8) };
  if (field === "dic") return { ...party, dic: value };
  if (field === "contactEmail") return { ...party, contactEmail: value };
  return party;
}

function parseLineNumber(value: string): number {
  return Number(value.replace(/\s/gu, "").replace(",", ".")) || 0;
}

function patchLine(
  line: GeneratorLine,
  field: string,
  value: string,
): GeneratorLine {
  if (field === "description") return { ...line, description: value };
  if (field === "unit") return { ...line, unit: value };
  if (field === "quantity")
    return { ...line, quantity: parseLineNumber(value) };
  if (field === "unitPriceWithoutVat") {
    return { ...line, unitPriceWithoutVat: parseLineNumber(value) };
  }
  if (field === "vatRate") return { ...line, vatRate: parseLineNumber(value) };
  return line;
}

function withParsedDate(
  draft: GeneratorDraft,
  field: "issueDate" | "dueDate",
  value: string,
): GeneratorDraft {
  const iso = parseInvoiceDateInput(value);
  if (!iso) return draft;
  if (field === "dueDate") return { ...draft, dueDate: iso };
  return withPrefillNumber({ ...draft, issueDate: iso });
}

export function applyLookEdit(
  draft: GeneratorDraft,
  edit: LookEdit,
): GeneratorDraft {
  if (edit.type === "party") {
    if (edit.side === "issuer") {
      return {
        ...draft,
        issuer: {
          ...draft.issuer,
          ...patchParty(draft.issuer, edit.field, edit.value),
        },
      };
    }
    return {
      ...draft,
      client: patchParty(draft.client, edit.field, edit.value),
    };
  }
  if (edit.type === "bank") {
    if (edit.field === "accountNumber") {
      return {
        ...draft,
        issuer: withSuggestedIban({
          ...draft.issuer,
          accountNumber: edit.value,
          accountTouched: true,
        }),
      };
    }
    return {
      ...draft,
      issuer: {
        ...draft.issuer,
        iban: edit.value.replace(/\s+/gu, "").toUpperCase(),
        ibanTouched: true,
      },
    };
  }
  if (edit.type === "meta") {
    if (edit.field === "number") {
      return { ...draft, number: edit.value, numberTouched: true };
    }
    if (edit.field === "dueDate") {
      return withParsedDate(draft, "dueDate", edit.value);
    }
    return withParsedDate(draft, "issueDate", edit.value);
  }
  if (edit.type === "notes") {
    return { ...draft, notes: edit.value };
  }
  if (edit.type === "line") {
    return {
      ...draft,
      items: draft.items.map((line, index) =>
        index === edit.index ? patchLine(line, edit.field, edit.value) : line,
      ),
    };
  }
  if (edit.type === "addLine") {
    const vatLocked = !draft.issuer.vatPayer;
    return {
      ...draft,
      items: [
        ...draft.items,
        {
          description: "",
          quantity: 1,
          unit: "ks",
          unitPriceWithoutVat: 0,
          vatRate: vatLocked ? 0 : 21,
        },
      ],
    };
  }
  return {
    ...draft,
    items:
      draft.items.length === 1
        ? draft.items
        : draft.items.filter((_, index) => index !== edit.index),
  };
}
