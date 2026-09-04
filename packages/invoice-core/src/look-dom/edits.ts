export type LookPartySide = "issuer" | "client";

export type LookPartyField =
  | "name"
  | "street"
  | "city"
  | "zip"
  | "country"
  | "ico"
  | "dic"
  | "contactEmail"
  | "registryNote";

export type LookLineField =
  | "description"
  | "quantity"
  | "unit"
  | "unitPriceWithoutVat"
  | "vatRate";

export type LookEdit =
  | {
      type: "party";
      side: LookPartySide;
      field: LookPartyField;
      value: string;
    }
  | { type: "bank"; field: "accountNumber" | "iban"; value: string }
  | {
      type: "meta";
      field: "number" | "issueDate" | "dueDate" | "duzp";
      value: string;
    }
  | { type: "notes"; value: string }
  | {
      type: "line";
      index: number;
      field: LookLineField;
      value: string;
    }
  | { type: "addLine" }
  | { type: "removeLine"; index: number };
