import { describe, expect, it } from "vitest";

import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import neplatceFixture from "../__fixtures__/invoices/neplatce-regular.json";
import proformaFixture from "../__fixtures__/invoices/proforma.json";
import reverseFixture from "../__fixtures__/invoices/reverse-charge.json";
import { InvoiceSchema, type Invoice } from "../schema";
import {
  canApplyLook,
  CLASSIC_LOOK_1_0_0,
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  getFirstPartyLook,
  LookDocumentSchema,
  MINIMAL_LOOK_1_0_0,
  MINIMAL_LOOK_ID,
  attachLookSnapshot,
  lookRefForNewDraft,
  resolveDraftLookRef,
  resolveLookDocument,
  validateLookDocument,
  validateLookForInvoice,
  type LookDocument,
} from "./index";

function parseInvoice(raw: unknown): Invoice {
  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    expect.fail(JSON.stringify(parsed.error.flatten()));
  }
  return parsed.data;
}

describe("first-party looks", () => {
  it("parses Classic and Minimal", () => {
    expect(LookDocumentSchema.parse(CLASSIC_LOOK_1_0_0).id).toBe("classic");
    expect(LookDocumentSchema.parse(MINIMAL_LOOK_1_0_0).id).toBe("minimal");
    expect(validateLookDocument(CLASSIC_LOOK_1_0_0)).toEqual([]);
    expect(validateLookDocument(MINIMAL_LOOK_1_0_0)).toEqual([]);
  });

  it("returns a look only for an exact id and version", () => {
    expect(getFirstPartyLook("classic", "1.0.0")?.name).toBe("Classic");
    expect(getFirstPartyLook("classic", "1.0.1")).toBeUndefined();
    expect(getFirstPartyLook("unknown", "1.0.0")).toBeUndefined();
  });
});

describe("validateLookDocument", () => {
  it("rejects a missing footer, compact on a non-payment block, and duplicate instances", () => {
    const noFooter: LookDocument = {
      ...CLASSIC_LOOK_1_0_0,
      layout: {
        bands: CLASSIC_LOOK_1_0_0.layout.bands.filter(
          (band) => band.type !== "footer",
        ),
      },
    };
    expect(
      validateLookDocument(noFooter).some((i) => /footer/u.test(i.message)),
    ).toBe(true);

    const compactLogo: LookDocument = {
      ...CLASSIC_LOOK_1_0_0,
      layout: {
        bands: [
          {
            type: "stack",
            slots: [
              { block: "logo", variant: "compact" },
              { block: "title" },
              { block: "issuer" },
              { block: "client" },
              { block: "lines" },
              { block: "totals" },
              { block: "tax" },
            ],
          },
          { type: "footer", slots: [{ block: "footer" }] },
        ],
      },
    };
    expect(
      validateLookDocument(compactLogo).some((i) => /compact/u.test(i.message)),
    ).toBe(true);
  });

  it("rejects a look that omits tax", () => {
    const noTax: LookDocument = {
      ...MINIMAL_LOOK_1_0_0,
      layout: {
        bands: [
          { type: "stack", slots: [{ block: "title" }] },
          {
            type: "row",
            split: "1/1",
            start: [{ block: "issuer" }],
            end: [{ block: "client" }],
          },
          { type: "stack", slots: [{ block: "lines" }, { block: "totals" }] },
          { type: "footer", slots: [{ block: "footer" }] },
        ],
      },
    };
    expect(
      validateLookDocument(noTax).some((i) => i.message.includes("tax")),
    ).toBe(true);
  });
});

describe("validateLookForInvoice", () => {
  it("accepts Classic for regular, reverse-charge, non-payer, and proforma invoices", () => {
    expect(
      validateLookForInvoice(CLASSIC_LOOK_1_0_0, parseInvoice(domesticFixture)),
    ).toEqual([]);
    expect(
      validateLookForInvoice(CLASSIC_LOOK_1_0_0, parseInvoice(reverseFixture)),
    ).toEqual([]);
    expect(
      validateLookForInvoice(CLASSIC_LOOK_1_0_0, parseInvoice(neplatceFixture)),
    ).toEqual([]);
    expect(
      validateLookForInvoice(CLASSIC_LOOK_1_0_0, parseInvoice(proformaFixture)),
    ).toEqual([]);
  });

  it("requires a payment block only for transfer invoices", () => {
    const withoutPayment: LookDocument = {
      ...MINIMAL_LOOK_1_0_0,
      layout: {
        bands: MINIMAL_LOOK_1_0_0.layout.bands.map((band) => {
          if (band.type !== "row") return band;
          return {
            ...band,
            start: band.start.filter((slot) => slot.block !== "payment"),
            end: band.end.filter((slot) => slot.block !== "payment"),
          };
        }),
      },
    };
    const cash = parseInvoice({
      ...domesticFixture,
      payment: { ...domesticFixture.payment, method: "cash" },
    });
    expect(validateLookForInvoice(withoutPayment, cash)).toEqual([]);
    expect(
      validateLookForInvoice(
        withoutPayment,
        parseInvoice(domesticFixture),
      ).some((issue) => issue.path === "slots.payment"),
    ).toBe(true);
  });
});

describe("resolveLookDocument", () => {
  it("uses Classic 1.0.0 when the invoice has no look", () => {
    const look = resolveLookDocument(parseInvoice(domesticFixture));
    expect(look.id).toBe(CLASSIC_LOOK_ID);
    expect(look.version).toBe(CLASSIC_LOOK_VERSION);
  });

  it("prefers a look snapshot over the live catalog", () => {
    const snapshot = {
      ...MINIMAL_LOOK_1_0_0,
      name: "Snapshotted Minimal",
    };
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION },
      lookSnapshot: snapshot,
    });
    expect(resolveLookDocument(invoice).name).toBe("Snapshotted Minimal");
  });

  it("falls back to Classic when the look id is unknown", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "does-not-exist", version: "1.0.0" },
    });
    expect(resolveLookDocument(invoice).id).toBe(CLASSIC_LOOK_ID);
  });

  it("merges appearance over the look theme", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: MINIMAL_LOOK_ID, version: "1.0.0" },
      appearance: { accent: "#ff0000", showQr: false },
    });
    const look = resolveLookDocument(invoice);
    expect(look.theme.accent).toBe("#ff0000");
    expect(look.theme.showQr).toBe(false);
    expect(look.theme.density).toBe("compact");
  });
});

describe("canApplyLook", () => {
  it("always allows Classic and gates the rest on catalog", () => {
    expect(canApplyLook("classic", "classic")).toBe(true);
    expect(canApplyLook("classic", "minimal")).toBe(false);
    expect(canApplyLook("catalog", "minimal")).toBe(true);
    expect(canApplyLook("catalog", "classic")).toBe(true);
  });
});

describe("lookRefForNewDraft / resolveDraftLookRef / attachLookSnapshot", () => {
  it("inherits the workspace default when the draft has no look", () => {
    expect(
      lookRefForNewDraft("catalog", undefined, {
        id: MINIMAL_LOOK_ID,
        version: "1.0.0",
      }),
    ).toEqual({ id: MINIMAL_LOOK_ID, version: "1.0.0" });
    expect(
      lookRefForNewDraft("classic", undefined, {
        id: MINIMAL_LOOK_ID,
        version: "1.0.0",
      }),
    ).toEqual({ id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION });
  });

  it("keeps a locked look already on the draft and refuses a new locked pick", () => {
    const kept = resolveDraftLookRef(
      "classic",
      { id: MINIMAL_LOOK_ID, version: "1.0.0" },
      { existing: { id: MINIMAL_LOOK_ID, version: "1.0.0" } },
    );
    expect(kept).toEqual({
      ok: true,
      look: { id: MINIMAL_LOOK_ID, version: "1.0.0" },
    });
    expect(
      resolveDraftLookRef("classic", {
        id: MINIMAL_LOOK_ID,
        version: "1.0.0",
      }),
    ).toEqual({ ok: false, error: "look_not_entitled" });
  });

  it("snapshots Classic at issue and refuses Minimal on classic apply", () => {
    const invoice = parseInvoice(domesticFixture);
    const attached = attachLookSnapshot(invoice, "classic");
    expect(attached.ok).toBe(true);
    if (attached.ok) {
      expect(attached.invoice.lookSnapshot?.id).toBe(CLASSIC_LOOK_ID);
    }

    const minimal = parseInvoice({
      ...domesticFixture,
      look: { id: MINIMAL_LOOK_ID, version: "1.0.0" },
    });
    expect(attachLookSnapshot(minimal, "classic")).toEqual({
      ok: false,
      error: "look_not_entitled",
    });
    const catalog = attachLookSnapshot(minimal, "catalog");
    expect(catalog.ok).toBe(true);
    if (catalog.ok) {
      expect(catalog.invoice.lookSnapshot?.id).toBe(MINIMAL_LOOK_ID);
    }
  });

  it("refuses an unknown look version at issue instead of falling back to Classic", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: CLASSIC_LOOK_ID, version: "9.9.9" },
    });
    expect(attachLookSnapshot(invoice, "classic")).toEqual({
      ok: false,
      error: "invalid_look",
    });
  });
});
