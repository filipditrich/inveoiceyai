import type {
  ClientSnapshot,
  IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

/** One issuer's numbering rule for a single document type. */
export type IssuerNumberingRule = {
  docType: string;
  template: string;
  counter: number;
  counterYear: number | null;
  resetPeriod: string;
  padding: number;
};

export type IssuerOption = {
  id: string;
  snapshot: IssuerSnapshot;
  schemes: IssuerNumberingRule[];
};

export type ClientOption = {
  id: string;
  snapshot: ClientSnapshot;
};
