import type { InvoiceLanguage } from "../schema";

export type LookEditPlaceholders = {
  readonly name: string;
  readonly street: string;
  readonly city: string;
  readonly zip: string;
  readonly ico: string;
  readonly icoHint: string;
  readonly dic: string;
  readonly email: string;
  readonly account: string;
  readonly iban: string;
  readonly line: string;
  readonly unit: string;
  readonly notes: string;
  readonly details: string;
  readonly hideDetails: string;
  readonly addLine: string;
  readonly removeLine: string;
};

const CS: LookEditPlaceholders = {
  name: "Název firmy",
  street: "Ulice a číslo",
  city: "Město",
  zip: "PSČ",
  ico: "12345678",
  icoHint: "ARES doplní firmu po zadání IČO",
  dic: "CZ12345678",
  email: "fakturace@firma.cz",
  account: "číslo/kód banky",
  iban: "CZ00 0000 0000 0000 0000 0000",
  line: "Popis položky",
  unit: "ks",
  notes: "Poznámka k dokladu",
  details: "Adresa a identifikace",
  hideDetails: "Skrýt adresu",
  addLine: "Přidat položku",
  removeLine: "Odebrat položku",
};

const EN: LookEditPlaceholders = {
  name: "Company name",
  street: "Street and number",
  city: "City",
  zip: "ZIP",
  ico: "12345678",
  icoHint: "ARES fills the company when you enter an IČO",
  dic: "CZ12345678",
  email: "billing@company.com",
  account: "number/bank code",
  iban: "CZ00 0000 0000 0000 0000 0000",
  line: "Line description",
  unit: "ks",
  notes: "Notes",
  details: "Address and IDs",
  hideDetails: "Hide address",
  addLine: "Add line",
  removeLine: "Remove line",
};

export function lookEditPlaceholders(
  language: InvoiceLanguage,
): LookEditPlaceholders {
  return language === "en" ? EN : CS;
}
