import type {
  InvoiceLanguage,
  IssuedByGender,
  IssuedBySnapshot,
} from "./schema";

export type InvoiceLabels = {
  supplier: string;
  customer: string;
  ico: string;
  dic: string;
  vat: string;
  nonVatPayer: string;
  contactEmail: string;
  bankAccount: string;
  variableSymbol: string;
  constantSymbol: string;
  specificSymbol: string;
  paymentMethod: string;
  issueDate: string;
  dueDate: string;
  taxPointDate: string;
  taxPointDateNonVat: string;
  colDescription: string;
  colQty: string;
  colUnit: string;
  colUnitPrice: string;
  colVat: string;
  colTotal: string;
  totalExVat: string;
  amountDue: string;
  notVatPayerLegal: string;
  reverseChargeTitle: string;
  reverseChargeDefault: string;
  ossTitle: string;
  ossDefault: string;
  paymentDetails: string;
  qrHint: string;
  payCash: string;
  payCard: string;
  notes: string;
  issuedVia: string;
  issuedByHim: string;
  issuedByHer: string;
  issuedByUnspecified: string;
  countryCz: string;
  payTransfer: string;
  payCashShort: string;
  payCardShort: string;
  docKindInvoice: string;
  docKindCreditNote: string;
  docKindProforma: string;
  docKindAdvance: string;
  titleInvoice: string;
  titleCreditNote: string;
  titleProforma: string;
  titleAdvance: string;
  docNo: string;
  correctsDocument: string;
  correctsDocumentIsdoc: string;
  previewWatermark: string;
};

const CS: InvoiceLabels = {
  supplier: "DODAVATEL",
  customer: "ODBĚRATEL",
  ico: "IČO",
  dic: "DIČ",
  vat: "DPH",
  nonVatPayer: "Neplátce",
  contactEmail: "Kontaktní email",
  bankAccount: "Bankovní účet",
  variableSymbol: "Variabilní symbol",
  constantSymbol: "Konstantní symbol",
  specificSymbol: "Specifický symbol",
  paymentMethod: "Způsob platby",
  issueDate: "Datum vystavení",
  dueDate: "Datum splatnosti",
  taxPointDate: "Datum zdan. plnění",
  taxPointDateNonVat: "Datum uskutečnění plnění",
  colDescription: "POPIS",
  colQty: "MNOŽSTVÍ",
  colUnit: "J.",
  colUnitPrice: "JEDN. CENA",
  colVat: "DPH",
  colTotal: "CELKEM",
  totalExVat: "Celkem bez DPH",
  amountDue: "K úhradě",
  notVatPayerLegal: "Nejsem plátce DPH.",
  reverseChargeTitle: "Přenesená daňová povinnost",
  reverseChargeDefault: "Daň odvede zákazník dle § 92a zákona č. 235/2004 Sb.",
  ossTitle: "Režim OSS",
  ossDefault:
    "Zdaněno v režimu jednoho registračního místa OSS (země příjemce).",
  paymentDetails: "PLATEBNÍ ÚDAJE",
  qrHint: "Úhradu můžete provést naskenováním QR kódu.",
  payCash: "Platba v hotovosti",
  payCard: "Platba kartou",
  notes: "Poznámka",
  issuedVia: "Vystaveno přes",
  issuedByHim: "Vystavil",
  issuedByHer: "Vystavila",
  issuedByUnspecified: "Vystavil(a)",
  countryCz: "Česká republika",
  payTransfer: "Převodem",
  payCashShort: "Hotově",
  payCardShort: "Kartou",
  docKindInvoice: "DAŇOVÝ DOKLAD",
  docKindCreditNote: "DOBROPIS",
  docKindProforma: "PROFORMA FAKTURA",
  docKindAdvance: "ZÁLOHOVÁ FAKTURA",
  titleInvoice: "Faktura",
  titleCreditNote: "Dobropis",
  titleProforma: "Proforma faktura",
  titleAdvance: "Zálohová faktura",
  docNo: "č.",
  correctsDocument: "Opravuje doklad č.:",
  correctsDocumentIsdoc: "Opravuje doklad č.",
  previewWatermark: "NÁHLED",
};

const EN: InvoiceLabels = {
  supplier: "SUPPLIER",
  customer: "CUSTOMER",
  ico: "Reg. No.",
  dic: "VAT ID",
  vat: "VAT",
  nonVatPayer: "Non-VAT payer",
  contactEmail: "Contact email",
  bankAccount: "Bank account",
  variableSymbol: "Variable symbol",
  constantSymbol: "Constant symbol",
  specificSymbol: "Specific symbol",
  paymentMethod: "Payment method",
  issueDate: "Issue date",
  dueDate: "Due date",
  taxPointDate: "Tax point date",
  taxPointDateNonVat: "Date of supply",
  colDescription: "DESCRIPTION",
  colQty: "QUANTITY",
  colUnit: "U.",
  colUnitPrice: "UNIT PRICE",
  colVat: "VAT",
  colTotal: "TOTAL",
  totalExVat: "Total excl. VAT",
  amountDue: "Amount due",
  notVatPayerLegal: "I am not a VAT payer.",
  reverseChargeTitle: "Reverse charge",
  reverseChargeDefault:
    "VAT to be accounted for by the customer under § 92a of Act No. 235/2004 Coll.",
  ossTitle: "OSS scheme",
  ossDefault: "Taxed under the One Stop Shop (OSS) scheme (customer country).",
  paymentDetails: "PAYMENT DETAILS",
  qrHint: "You can pay by scanning the QR code.",
  payCash: "Cash payment",
  payCard: "Card payment",
  notes: "Notes",
  issuedVia: "Issued with",
  issuedByHim: "Issued by",
  issuedByHer: "Issued by",
  issuedByUnspecified: "Issued by",
  countryCz: "Czech Republic",
  payTransfer: "Bank transfer",
  payCashShort: "Cash",
  payCardShort: "Card",
  docKindInvoice: "TAX DOCUMENT",
  docKindCreditNote: "CREDIT NOTE",
  docKindProforma: "PROFORMA INVOICE",
  docKindAdvance: "ADVANCE INVOICE",
  titleInvoice: "Invoice",
  titleCreditNote: "Credit note",
  titleProforma: "Proforma invoice",
  titleAdvance: "Advance invoice",
  docNo: "No.",
  correctsDocument: "Corrects document no.:",
  correctsDocumentIsdoc: "Corrects document no.",
  previewWatermark: "PREVIEW",
};

const ISDOC_COUNTRY_CS: Record<string, string> = {
  CZ: "Česká republika",
  SK: "Slovensko",
  DE: "Německo",
  PL: "Polsko",
  AT: "Rakousko",
  GB: "Spojené království",
  US: "Spojené státy",
  FR: "Francie",
};

const ISDOC_COUNTRY_EN: Record<string, string> = {
  CZ: "Czech Republic",
  SK: "Slovakia",
  DE: "Germany",
  PL: "Poland",
  AT: "Austria",
  GB: "United Kingdom",
  US: "United States",
  FR: "France",
};

export function invoiceLabels(language: InvoiceLanguage): InvoiceLabels {
  switch (language) {
    case "cs":
      return CS;
    case "en":
      return EN;
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function toInvoiceIntlLocale(language: InvoiceLanguage): string {
  switch (language) {
    case "cs":
      return "cs-CZ";
    case "en":
      return "en-GB";
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}

export function isdocCountryName(
  alpha2: string,
  language: InvoiceLanguage,
): string {
  const map = language === "en" ? ISDOC_COUNTRY_EN : ISDOC_COUNTRY_CS;
  return map[alpha2] ?? alpha2;
}

export function issuedByVerb(
  language: InvoiceLanguage,
  gender: IssuedByGender,
): string {
  const labels = invoiceLabels(language);
  switch (gender) {
    case "him":
      return labels.issuedByHim;
    case "her":
      return labels.issuedByHer;
    case "unspecified":
      return labels.issuedByUnspecified;
    default: {
      const _exhaustive: never = gender;
      return _exhaustive;
    }
  }
}

export function issuedByFooterLine(
  language: InvoiceLanguage,
  issuedBy: IssuedBySnapshot,
): string {
  return `${issuedByVerb(language, issuedBy.gender)}: ${issuedBy.name}`;
}
