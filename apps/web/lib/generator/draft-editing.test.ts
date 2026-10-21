import { describe, expect, it } from "vitest";

import {
  guestDisplayInvoiceFromDraft,
  guestInvoiceFromDraft,
  sampleGeneratorDraft,
} from "./draft";

function draftForEditing() {
  return sampleGeneratorDraft({
    issuerId: "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd",
    clientId: "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff",
    locale: "en",
  });
}

describe("generator controlled text fields", () => {
  // Production bug: render-time trimming removes a just-typed word separator
  // from the controlled input before the visitor types the following word.
  it("preserves a trailing word separator in descriptions and units while editing", () => {
    const draft = draftForEditing();
    draft.items[0]!.description = "Design ";
    draft.items[0]!.unit = "work ";
    const display = guestDisplayInvoiceFromDraft(draft);
    expect(display?.items[0]?.description).toBe("Design ");
    expect(display?.items[0]?.unit).toBe("work ");
    const issued = guestInvoiceFromDraft(draft);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.invoice.items[0]?.description).toBe("Design");
    expect(issued.invoice.items[0]?.unit).toBe("work");
  });

  it("preserves word separators in party names and addresses while editing", () => {
    const draft = draftForEditing();
    draft.issuer.name = "Studio ";
    draft.issuer.street = "Na ";
    draft.issuer.city = "Praha ";
    draft.issuer.zip = "110 ";
    draft.client.name = "Client ";
    draft.client.street = "Main ";
    draft.client.city = "New ";
    const display = guestDisplayInvoiceFromDraft(draft);
    expect(display?.issuer.name).toBe("Studio ");
    expect(display?.issuer.address.street).toBe("Na ");
    expect(display?.issuer.address.city).toBe("Praha ");
    expect(display?.issuer.address.zip).toBe("110 ");
    expect(display?.client.name).toBe("Client ");
    expect(display?.client.address.street).toBe("Main ");
    expect(display?.client.address.city).toBe("New ");
  });

  it("preserves a trailing space and a new line in notes while editing", () => {
    const draft = draftForEditing();
    draft.notes = "Thank you \n";
    expect(guestDisplayInvoiceFromDraft(draft)?.notes).toBe("Thank you \n");
    draft.items[0]!.unit = "";
    expect(guestDisplayInvoiceFromDraft(draft)?.items[0]?.unit).toBe("");
  });
});
