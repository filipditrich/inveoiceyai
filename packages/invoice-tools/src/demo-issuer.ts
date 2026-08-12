import {
  IssuerSnapshotSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

/** Demo issuer — mirrors packages/invoice-core proforma fixture issuer fields. */
const FALLBACK_ISSUER: IssuerSnapshot = {
  id: "e5555555-5555-5555-5555-555555555555",
  name: "Služby s.r.o.",
  ico: "33333333",
  dic: "CZ3333333356",
  address: {
    street: "Provozní 9",
    city: "Brno",
    zip: "602 00",
    country: "CZ",
  },
  bank: {
    accountNumber: "999888/6060",
    iban: "CZ6060600000000000999888",
  },
  vatPayer: true,
  contactEmail: "faktura@sluzby-demo.cz",
};

/**
 * Loads the fixed issuer for stateless demos (Slack / MCP).
 * Override with `INVOICEY_DEMO_ISSUER_JSON` (full `IssuerSnapshot` JSON).
 */
export function getDemoIssuer(): IssuerSnapshot {
  const raw = process.env.INVOICEY_DEMO_ISSUER_JSON;
  if (raw == null || raw.trim() === "") {
    return FALLBACK_ISSUER;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("INVOICEY_DEMO_ISSUER_JSON must be valid JSON");
  }
  return IssuerSnapshotSchema.parse(parsed);
}
