import type { InvoiceLabels } from "../labels";
import type { LookDocument } from "../looks";
import type { LookStyleIr } from "../looks/style-ir";
import type { Invoice } from "../schema";
import type { LookEdit } from "./edits";

export type LookDomAssets = {
  readonly qrDataUrl?: string | null;
  readonly logoUrl?: string | null;
  readonly stampUrl?: string | null;
  readonly signatureUrl?: string | null;
};

export type LookDomCtx = {
  readonly invoice: Invoice;
  readonly look: LookDocument;
  readonly labels: InvoiceLabels;
  readonly intlLocale: string;
  readonly styles: LookStyleIr;
  readonly assets: LookDomAssets;
  readonly onEdit?: (edit: LookEdit) => void;
  readonly column?: "start" | "end";
};
