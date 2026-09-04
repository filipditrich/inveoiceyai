import {
  addDaysIso,
  todayIsoDate,
  tryBuildInvoicePayload,
  type BuilderInvoiceInput,
} from "@/lib/build-invoice";

import type { ClientDraft } from "@invoicey/ares";
import {
  ACCENT_COLOR_HEX,
  appearanceFromPicker,
  CLASSIC_LOOK_1_0_0,
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  type LegacyAccentColor,
} from "@invoicey/invoice-core/looks";
import { suggestCzIban } from "@invoicey/invoice-core/schema";
import type {
  ClientSnapshot,
  Invoice,
  InvoiceCurrency,
  InvoiceLanguage,
  IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

import { defaultGuestInvoiceNumber } from "./default-number";
import type { AppLocale } from "@/i18n/config";

export type GeneratorAccentKey = "default" | LegacyAccentColor;

export type GeneratorParty = {
  id: string;
  ico: string;
  name: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  contactEmail: string;
};

export type GeneratorIssuer = GeneratorParty & {
  vatPayer: boolean;
  accountNumber: string;
  iban: string;
  ibanTouched: boolean;
};

export type GeneratorLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceWithoutVat: number;
  vatRate: number;
};

export type GeneratorDraft = {
  issuer: GeneratorIssuer;
  client: GeneratorParty;
  number: string;
  numberTouched: boolean;
  issueDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  language: InvoiceLanguage;
  vatMode: "regular" | "reverse_charge";
  notes: string;
  accentKey: GeneratorAccentKey;
  showQr: boolean;
  items: GeneratorLine[];
};

function emptyParty(id: string, country: string): GeneratorParty {
  return {
    id,
    ico: "",
    name: "",
    dic: "",
    street: "",
    city: "",
    zip: "",
    country,
    contactEmail: "",
  };
}

export function emptyGeneratorDraft(input: {
  issuerId: string;
  clientId: string;
  locale: AppLocale;
}): GeneratorDraft {
  const issueDate = todayIsoDate();
  return {
    issuer: {
      ...emptyParty(input.issuerId, "CZ"),
      vatPayer: true,
      accountNumber: "",
      iban: "",
      ibanTouched: false,
    },
    client: emptyParty(input.clientId, "CZ"),
    number: defaultGuestInvoiceNumber(
      "Invoice",
      new Date(`${issueDate}T12:00:00.000Z`),
    ),
    numberTouched: false,
    issueDate,
    dueDate: addDaysIso(issueDate, 14),
    currency: "CZK",
    language: input.locale,
    vatMode: "regular",
    notes: "",
    accentKey: "default",
    showQr: true,
    items: [
      {
        description: "",
        quantity: 1,
        unit: "ks",
        unitPriceWithoutVat: 0,
        vatRate: 21,
      },
    ],
  };
}

export function applyAresToParty(
  party: GeneratorParty,
  draft: ClientDraft,
): GeneratorParty {
  return {
    ...party,
    ico: draft.ico ?? party.ico,
    name: draft.name,
    dic: draft.dic ?? "",
    street: draft.address.street,
    city: draft.address.city,
    zip: draft.address.zip,
    country: draft.address.country || party.country,
    contactEmail: draft.contactEmail ?? party.contactEmail,
  };
}

export function withSuggestedIban(issuer: GeneratorIssuer): GeneratorIssuer {
  const suggested = suggestCzIban(issuer.accountNumber);
  if (issuer.ibanTouched) return issuer;
  return { ...issuer, iban: suggested ?? issuer.iban };
}

export function withPrefillNumber(draft: GeneratorDraft): GeneratorDraft {
  if (draft.numberTouched) return draft;
  const issueDate = new Date(`${draft.issueDate}T12:00:00.000Z`);
  return {
    ...draft,
    number: defaultGuestInvoiceNumber(
      draft.issuer.name || "Invoice",
      issueDate,
    ),
  };
}

function appearanceForDraft(draft: GeneratorDraft) {
  return appearanceFromPicker({
    lookTheme: CLASSIC_LOOK_1_0_0.theme,
    accent:
      draft.accentKey === "default"
        ? undefined
        : ACCENT_COLOR_HEX[draft.accentKey],
    showQr: draft.showQr,
  });
}

function issuerSnapshot(draft: GeneratorDraft): IssuerSnapshot {
  const bank = withSuggestedIban(draft.issuer);
  const issuer: IssuerSnapshot = {
    id: draft.issuer.id,
    name: draft.issuer.name.trim(),
    ico: draft.issuer.ico.replace(/\s/gu, ""),
    address: {
      street: draft.issuer.street.trim(),
      city: draft.issuer.city.trim(),
      zip: draft.issuer.zip.trim(),
      country: "CZ",
    },
    bank: {
      accountNumber: bank.accountNumber.trim(),
      iban: bank.iban.replace(/\s+/gu, "").toUpperCase(),
    },
    vatPayer: draft.issuer.vatPayer,
    contactEmail: draft.issuer.contactEmail.trim(),
  };
  const dic = draft.issuer.dic.trim();
  if (dic) issuer.dic = dic;
  return issuer;
}

function clientSnapshot(draft: GeneratorDraft): ClientSnapshot {
  const client: ClientSnapshot = {
    id: draft.client.id,
    name: draft.client.name.trim(),
    address: {
      street: draft.client.street.trim(),
      city: draft.client.city.trim(),
      zip: draft.client.zip.trim(),
      country: (draft.client.country.trim() || "CZ").toUpperCase(),
    },
  };
  const ico = draft.client.ico.replace(/\s/gu, "");
  const dic = draft.client.dic.trim();
  const contactEmail = draft.client.contactEmail.trim();
  if (ico) client.ico = ico;
  if (dic) client.dic = dic;
  if (contactEmail) client.contactEmail = contactEmail;
  return client;
}

function builderInput(
  draft: GeneratorDraft,
  items: GeneratorLine[],
): BuilderInvoiceInput {
  const numbered = withPrefillNumber(draft);
  return {
    docType: "invoice",
    number: numbered.number,
    issueDate: numbered.issueDate,
    dueDate: numbered.dueDate,
    duzp: numbered.issueDate,
    currency: numbered.currency === "USD" ? "CZK" : numbered.currency,
    language: numbered.language,
    issuer: issuerSnapshot(numbered),
    client: clientSnapshot(numbered),
    vatMode: numbered.issuer.vatPayer ? numbered.vatMode : "regular",
    suppliesAbroad: "none",
    items,
    notes: numbered.notes.trim() || undefined,
    look: { id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION },
    lookSnapshot: CLASSIC_LOOK_1_0_0,
    appearance: appearanceForDraft(numbered),
  };
}

/**
 * Strict build for issue. Preview callers pass placeholder lines so the PDF
 * can render before every field is valid.
 */
export function guestInvoiceFromDraft(
  draft: GeneratorDraft,
): { ok: true; invoice: Invoice } | { ok: false; message: string } {
  const items = draft.items.map((line) => ({
    ...line,
    description: line.description.trim(),
    unit: line.unit.trim() || "ks",
  }));
  if (items.some((line) => line.description.length === 0)) {
    return { ok: false, message: "line description required" };
  }
  return tryBuildInvoicePayload(builderInput(draft, items));
}

export function guestPreviewInvoiceFromDraft(
  draft: GeneratorDraft,
): { ok: true; invoice: Invoice } | { ok: false; message: string } {
  const items = draft.items.map((line) => ({
    ...line,
    description: line.description.trim() || "—",
    unit: line.unit.trim() || "ks",
  }));
  return tryBuildInvoicePayload(builderInput(draft, items));
}
