export const INVOICE_SORT_KEYS = [
  "issueDate",
  "dueDate",
  "clientName",
  "total",
  "number",
] as const;

export type InvoiceSortKey = (typeof INVOICE_SORT_KEYS)[number];

export type InvoiceSort = {
  id: InvoiceSortKey;
  desc: boolean;
};

const SORT_KEY_SET = new Set<string>(INVOICE_SORT_KEYS);
const DEFAULT_SORT: InvoiceSort = { id: "issueDate", desc: true };

export function parseInvoiceSort(sort?: string | null): InvoiceSort {
  if (!sort || sort === "date_desc") return DEFAULT_SORT;
  if (sort === "date_asc") return { id: "issueDate", desc: false };

  const [rawId, rawDirection] = sort.split(".");
  if (!rawId || !SORT_KEY_SET.has(rawId)) return DEFAULT_SORT;

  return {
    id: rawId as InvoiceSortKey,
    desc: rawDirection !== "asc",
  };
}

export function serializeInvoiceSort(sort: InvoiceSort): string {
  return `${sort.id}.${sort.desc ? "desc" : "asc"}`;
}
