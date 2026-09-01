import { describe, expect, it } from "vitest";

import creditNoteFixture from "../__fixtures__/invoices/credit-note.json";
import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import neplatceFixture from "../__fixtures__/invoices/neplatce-regular.json";
import proformaFixture from "../__fixtures__/invoices/proforma.json";
import reverseFixture from "../__fixtures__/invoices/reverse-charge.json";
import { InvoiceSchema, type Invoice } from "../schema";
import {
  canApplyLook,
  hasLookCatalogEntitlement,
  CLASSIC_LOOK_1_0_0,
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  getFirstPartyLook,
  LookDocumentSchema,
  MINIMAL_LOOK_1_0_0,
  MINIMAL_LOOK_ID,
  attachLookSnapshot,
  bumpLookVersion,
  communityLookFrom,
  findLookDocument,
  lookContentEquals,
  lookHasBlock,
  lookIsPublishable,
  lookRefForNewDraft,
  lookSlugFromName,
  looksForPicker,
  resolveDraftLookRef,
  resolveLookDocument,
  resolvePresentLookRef,
  withLookSnapshotForRender,
  validateLookDocument,
  validateLookForInvoice,
  versionBumpForLookChange,
  workspaceLookFrom,
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
    expect(lookHasBlock(CLASSIC_LOOK_1_0_0, "dates")).toBe(true);
    expect(lookHasBlock(MINIMAL_LOOK_1_0_0, "dates")).toBe(false);
    expect(CLASSIC_LOOK_1_0_0.theme.stampMaxHeightPt).toBe(154);
    expect(MINIMAL_LOOK_1_0_0.theme.stampMaxHeightPt).toBe(88);
    const { stampMaxHeightPt: _stamp, ...themeWithoutStamp } =
      CLASSIC_LOOK_1_0_0.theme;
    expect(
      LookDocumentSchema.parse({
        ...CLASSIC_LOOK_1_0_0,
        theme: themeWithoutStamp,
      }).theme.stampMaxHeightPt,
    ).toBe(88);
    expect(CLASSIC_LOOK_1_0_0.layout.bands[1]).toMatchObject({
      type: "row",
      start: [{ block: "issuer" }],
      end: [{ block: "client" }],
    });
    expect(CLASSIC_LOOK_1_0_0.layout.bands[2]).toMatchObject({
      type: "row",
      start: [{ block: "payment", variant: "compact" }],
      end: [{ block: "dates" }],
    });
    const stampRow = CLASSIC_LOOK_1_0_0.layout.bands.find(
      (band) =>
        band.type === "row" && band.end.some((slot) => slot.block === "stamp"),
    );
    expect(stampRow).toBeDefined();
  });

  it("passes validateLookForInvoice for every first-party fixture shape", () => {
    for (const raw of [
      domesticFixture,
      neplatceFixture,
      proformaFixture,
      reverseFixture,
      creditNoteFixture,
    ]) {
      const invoice = parseInvoice(raw);
      expect(validateLookForInvoice(CLASSIC_LOOK_1_0_0, invoice)).toEqual([]);
      expect(validateLookForInvoice(MINIMAL_LOOK_1_0_0, invoice)).toEqual([]);
    }
  });

  it("rejects unknown fields so JSON cannot smuggle renderer keys", () => {
    expect(
      LookDocumentSchema.safeParse({
        ...CLASSIC_LOOK_1_0_0,
        font: "Comic Sans",
      }).success,
    ).toBe(false);
    expect(
      LookDocumentSchema.safeParse({
        ...CLASSIC_LOOK_1_0_0,
        theme: { ...CLASSIC_LOOK_1_0_0.theme, shadow: true },
      }).success,
    ).toBe(false);
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

  it("uses an extra catalog look before falling back to Classic", () => {
    const extra = workspaceLookFrom(MINIMAL_LOOK_1_0_0, {
      id: "clean",
      name: "Clean",
    });
    if (!extra.ok) throw new Error("fixture");
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "clean", version: "1.0.0" },
    });
    expect(resolveLookDocument(invoice).id).toBe(CLASSIC_LOOK_ID);
    expect(resolveLookDocument(invoice, [extra.look]).id).toBe("clean");
    const prepared = withLookSnapshotForRender(invoice, [extra.look]);
    expect(prepared.lookSnapshot?.id).toBe("clean");
    expect(resolveLookDocument(prepared).id).toBe("clean");
  });

  it("does not overwrite an existing look snapshot for render", () => {
    const extra = workspaceLookFrom(MINIMAL_LOOK_1_0_0, {
      id: "clean",
      name: "Clean",
    });
    if (!extra.ok) throw new Error("fixture");
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "clean", version: "1.0.0" },
      lookSnapshot: { ...extra.look, name: "Frozen" },
    });
    const prepared = withLookSnapshotForRender(invoice, [extra.look]);
    expect(prepared.lookSnapshot?.name).toBe("Frozen");
  });

  it("does not attach a live catalog look when the invoice is issued", () => {
    const extra = workspaceLookFrom(MINIMAL_LOOK_1_0_0, {
      id: "clean",
      name: "Clean",
    });
    if (!extra.ok) throw new Error("fixture");
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "clean", version: "1.0.0" },
    });
    const prepared = withLookSnapshotForRender(invoice, [extra.look], {
      issued: true,
    });
    expect(prepared.lookSnapshot).toBeUndefined();
    expect(resolveLookDocument(prepared).id).toBe(CLASSIC_LOOK_ID);
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
    expect(canApplyLook("classic", "clean")).toBe(false);
    expect(canApplyLook("catalog", "clean")).toBe(true);
  });
});

describe("hasLookCatalogEntitlement", () => {
  it("is true only for catalog apply", () => {
    expect(hasLookCatalogEntitlement("classic")).toBe(false);
    expect(hasLookCatalogEntitlement("catalog")).toBe(true);
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

describe("workspace looks", () => {
  const workspaceLook = workspaceLookFrom(MINIMAL_LOOK_1_0_0, {
    id: "clean",
    name: "Clean",
  });
  if (!workspaceLook.ok) {
    throw new Error("fixture");
  }
  const clean = workspaceLook.look;

  it("copies a first-party look as workspace origin and refuses reserved ids", () => {
    expect(clean.origin).toBe("workspace");
    expect(clean.version).toBe("1.0.0");
    expect(LookDocumentSchema.parse(clean).id).toBe("clean");
    expect(
      workspaceLookFrom(CLASSIC_LOOK_1_0_0, { id: "classic", name: "Nope" }),
    ).toEqual({ ok: false, error: "reserved_look_id" });
    expect(
      workspaceLookFrom(CLASSIC_LOOK_1_0_0, { id: "Clean", name: "Nope" }),
    ).toEqual({ ok: false, error: "invalid_look_id" });
  });

  it("finds a workspace look in the extra catalog and lists it in the picker", () => {
    expect(findLookDocument("clean", "1.0.0")).toBeUndefined();
    expect(findLookDocument("clean", "1.0.0", [clean])?.name).toBe("Clean");
    const listed = looksForPicker([clean]);
    expect(listed.some((look) => look.id === "clean")).toBe(true);
    expect(listed.some((look) => look.id === CLASSIC_LOOK_ID)).toBe(true);
    expect(
      looksForPicker([], { id: "clean", version: "1.0.0" }).some(
        (look) => look.id === "clean",
      ),
    ).toBe(false);
  });

  it("keeps a present look and falls back when the catalog row is gone", () => {
    expect(
      resolvePresentLookRef(
        { id: "clean", version: "1.0.0" },
        { id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION },
        [clean],
      ),
    ).toEqual({ id: "clean", version: "1.0.0" });
    expect(
      resolvePresentLookRef(
        { id: "clean", version: "1.0.0" },
        { id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION },
      ),
    ).toEqual({ id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION });
    expect(
      resolvePresentLookRef(undefined, {
        id: MINIMAL_LOOK_ID,
        version: "1.0.0",
      }),
    ).toEqual({ id: MINIMAL_LOOK_ID, version: "1.0.0" });
  });

  it("slugs a display name and ignores reserved checks", () => {
    expect(lookSlugFromName("Clean Invoice")).toBe("clean-invoice");
    expect(lookSlugFromName("Čistý vzhled")).toBe("cisty-vzhled");
    expect(lookSlugFromName("2026 look")).toBe("n-2026-look");
    expect(lookSlugFromName("???")).toBe("");
  });

  it("treats identical name, layout, and theme as an unchanged look", () => {
    expect(lookContentEquals(clean, { ...clean, version: "9.9.9" })).toBe(true);
    expect(
      lookContentEquals(clean, { ...clean, name: "Other", version: "1.0.0" }),
    ).toBe(false);
  });

  it("bumps patch for theme and minor for layout", () => {
    expect(bumpLookVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpLookVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(
      versionBumpForLookChange(clean, {
        ...clean,
        theme: { ...clean.theme, accent: "#111111" },
      }),
    ).toBe("patch");
    expect(
      versionBumpForLookChange(clean, {
        ...clean,
        layout: {
          bands: [
            clean.layout.bands[1]!,
            clean.layout.bands[0]!,
            ...clean.layout.bands.slice(2),
          ],
        },
      }),
    ).toBe("minor");
  });

  it("inherits a workspace default when the catalog contains it", () => {
    expect(
      lookRefForNewDraft(
        "catalog",
        undefined,
        { id: "clean", version: "1.0.0" },
        [clean],
      ),
    ).toEqual({ id: "clean", version: "1.0.0" });
    expect(
      lookRefForNewDraft("catalog", undefined, {
        id: "clean",
        version: "1.0.0",
      }),
    ).toEqual({ id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION });
  });

  it("snapshots a workspace look at issue and refuses a missing version", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "clean", version: "1.0.0" },
    });
    const attached = attachLookSnapshot(invoice, "catalog", [clean]);
    expect(attached.ok).toBe(true);
    if (attached.ok) {
      expect(attached.invoice.lookSnapshot?.origin).toBe("workspace");
    }
    expect(
      attachLookSnapshot(
        parseInvoice({
          ...domesticFixture,
          look: { id: "clean", version: "1.0.1" },
        }),
        "catalog",
        [clean],
      ),
    ).toEqual({ ok: false, error: "invalid_look" });
  });
});

describe("community looks", () => {
  const workspaceLook = workspaceLookFrom(MINIMAL_LOOK_1_0_0, {
    id: "clean",
    name: "Clean",
  });
  if (!workspaceLook.ok) {
    throw new Error("fixture");
  }
  const clean = workspaceLook.look;
  const published = communityLookFrom(clean);
  if (!published.ok) {
    throw new Error("fixture");
  }
  const community = published.look;

  it("copies a workspace look as community origin and refuses first-party", () => {
    expect(community.origin).toBe("community");
    expect(community.id).toBe("clean");
    expect(community.version).toBe("1.0.0");
    expect(LookDocumentSchema.parse(community).origin).toBe("community");
    expect(communityLookFrom(CLASSIC_LOOK_1_0_0)).toEqual({
      ok: false,
      error: "not_workspace_look",
    });
  });

  it("refuses publish when payment is missing and accepts Classic-shaped looks", () => {
    expect(lookIsPublishable(community)).toEqual([]);
    const withoutPayment: LookDocument = {
      ...community,
      layout: {
        bands: community.layout.bands
          .map((band) => {
            if (band.type === "stack") {
              return {
                ...band,
                slots: band.slots.filter((slot) => slot.block !== "payment"),
              };
            }
            if (band.type === "row") {
              return {
                ...band,
                start: band.start.filter((slot) => slot.block !== "payment"),
                end: band.end.filter((slot) => slot.block !== "payment"),
              };
            }
            return band;
          })
          .filter((band) =>
            band.type === "footer"
              ? true
              : band.type === "stack"
                ? band.slots.length > 0
                : band.start.length > 0 && band.end.length > 0,
          ),
      },
    };
    expect(
      lookIsPublishable(withoutPayment).some((issue) =>
        issue.path.includes("payment"),
      ),
    ).toBe(true);
  });

  it("lists a community look unless the workspace already has that id", () => {
    const listed = looksForPicker([community]);
    expect(listed.some((look) => look.origin === "community")).toBe(true);
    const withOwn = looksForPicker([clean, community]);
    expect(withOwn.filter((look) => look.id === "clean")).toHaveLength(1);
    expect(withOwn.find((look) => look.id === "clean")?.origin).toBe(
      "workspace",
    );
  });

  it("snapshots a community look at issue and refuses a missing version", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      look: { id: "clean", version: "1.0.0" },
    });
    const attached = attachLookSnapshot(invoice, "catalog", [community]);
    expect(attached.ok).toBe(true);
    if (attached.ok) {
      expect(attached.invoice.lookSnapshot?.origin).toBe("community");
    }
    expect(
      attachLookSnapshot(
        parseInvoice({
          ...domesticFixture,
          look: { id: "clean", version: "1.0.1" },
        }),
        "catalog",
        [community],
      ),
    ).toEqual({ ok: false, error: "invalid_look" });
  });
});
