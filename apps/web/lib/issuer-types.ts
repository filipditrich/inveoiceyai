export const DOC_TYPES = [
  { key: "invoice", label: "Faktura (FV)" },
  { key: "proforma", label: "Proforma (PF)" },
  { key: "advance", label: "Záloha (ZF)" },
  { key: "credit_note", label: "Dobropis (DOB)" },
] as const;

export const DEFAULT_TEMPLATES: Record<
  (typeof DOC_TYPES)[number]["key"],
  string
> = {
  invoice: "{YYYY}{####}",
  proforma: "PF-{YYYY}-{####}",
  advance: "ZF-{YYYY}-{####}",
  credit_note: "DOB-{YYYY}-{####}",
};

export type NumberingSchemeDraft = {
  docType: (typeof DOC_TYPES)[number]["key"];
  template: string;
  resetPeriod: "yearly" | "never";
  counter: number;
  counterYear: number | null;
  padding: number;
};
