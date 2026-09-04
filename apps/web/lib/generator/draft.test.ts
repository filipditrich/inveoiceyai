import { describe, expect, it } from "vitest";

import {
  applyAresToParty,
  emptyGeneratorDraft,
  guestDisplayInvoiceFromDraft,
  guestInvoiceFromDraft,
  guestPreviewInvoiceFromDraft,
  sampleGeneratorDraft,
  withPrefillNumber,
  withSuggestedIban,
} from "./draft";

const ISSUER_ID = "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd";
const CLIENT_ID = "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff";

function completeDraft() {
  const draft = emptyGeneratorDraft({
    issuerId: ISSUER_ID,
    clientId: CLIENT_ID,
    locale: "cs",
  });
  draft.issueDate = "2026-09-04";
  draft.dueDate = "2026-09-18";
  draft.issuer = {
    ...draft.issuer,
    name: "Acme Supplier s.r.o.",
    ico: "12345678",
    dic: "CZ12345678",
    street: "Na Příkopě 14",
    city: "Praha",
    zip: "110 00",
    contactEmail: "fakturace@acmesupplier.example",
    accountNumber: "19-2000145399/0800",
    iban: "",
    ibanTouched: false,
    vatPayer: true,
  };
  draft.client = {
    ...draft.client,
    name: "NFCtron s.r.o.",
    ico: "87654321",
    street: "Křížová 2598/4",
    city: "Brno",
    zip: "603 00",
  };
  draft.items = [
    {
      description: "September retainer",
      quantity: 1,
      unit: "ks",
      unitPriceWithoutVat: 1000,
      vatRate: 21,
    },
  ];
  return withPrefillNumber(draft);
}

describe("guestInvoiceFromDraft", () => {
  it("issues a classic CZK invoice with a suggested IBAN", () => {
    const built = guestInvoiceFromDraft(completeDraft());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.invoice.meta.number).toBe("20260001");
    expect(built.invoice.meta.currency).toBe("CZK");
    expect(built.invoice.look).toEqual({ id: "classic", version: "1.0.0" });
    expect(built.invoice.issuer.bank.iban).toBe("CZ6508000000192000145399");
    expect(built.invoice.totals.total).toBe(1210);
  });

  it("refuses to issue without a line description", () => {
    const draft = completeDraft();
    draft.items[0]!.description = "  ";
    expect(guestInvoiceFromDraft(draft).ok).toBe(false);
    expect(guestPreviewInvoiceFromDraft(draft).ok).toBe(true);
  });
});

describe("sampleGeneratorDraft", () => {
  it("issues immediately so the generator can show a live PDF", () => {
    const draft = sampleGeneratorDraft({
      issuerId: ISSUER_ID,
      clientId: CLIENT_ID,
      locale: "cs",
    });
    const built = guestInvoiceFromDraft(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.invoice.issuer.name).toBe("Studio Ukázka s.r.o.");
    expect(built.invoice.totals.total).toBe(9680);
    const display = guestDisplayInvoiceFromDraft(draft);
    expect(built.invoice.issuer.bank.iban).toBe("CZ6508000000192000145399");
    expect(display?.issuer.ico).toBe("12345678");
    expect(display?.items[0]?.description).toContain("Grafické");
  });
});
describe("guestPreviewInvoiceFromDraft", () => {
  it("builds a Classic invoice from an empty draft so the editor can mount", () => {
    const draft = emptyGeneratorDraft({
      issuerId: ISSUER_ID,
      clientId: CLIENT_ID,
      locale: "cs",
    });
    const preview = guestPreviewInvoiceFromDraft(draft);
    expect(preview.ok).toBe(true);
    const display = guestDisplayInvoiceFromDraft(draft);
    expect(display).not.toBeNull();
    expect(display?.issuer.name).toBe("");
    expect(display?.issuer.ico).toBe("");
    expect(display?.issuer.contactEmail).toBe("");
    expect(display?.client.name).toBe("");
    expect(display?.items[0]?.description).toBe("");
  });
});

describe("applyAresToParty", () => {
  it("copies ARES identity onto the party and keeps the id", () => {
    const party = emptyGeneratorDraft({
      issuerId: ISSUER_ID,
      clientId: CLIENT_ID,
      locale: "en",
    }).client;
    const next = applyAresToParty(party, {
      name: "Studio Sever",
      ico: "27082440",
      address: {
        street: "Ulice 1",
        city: "Praha",
        zip: "110 00",
        country: "CZ",
      },
    });
    expect(next.id).toBe(CLIENT_ID);
    expect(next.name).toBe("Studio Sever");
    expect(next.ico).toBe("27082440");
  });
});

describe("withSuggestedIban", () => {
  it("does not overwrite a manual IBAN", () => {
    const issuer = completeDraft().issuer;
    issuer.iban = "CZ6508000000192000145399";
    issuer.ibanTouched = true;
    issuer.accountNumber = "123456789/0100";
    expect(withSuggestedIban(issuer).iban).toBe("CZ6508000000192000145399");
  });
});
