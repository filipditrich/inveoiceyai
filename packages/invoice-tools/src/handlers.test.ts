import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAndRenderInvoice } from "./handlers";
import { getDemoIssuer } from "./demo-issuer";
import { savePreset } from "./presets";

describe("createAndRenderInvoice", () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("renders PDF and ISDOC from a draft + issuer preset", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "invoicey-handlers-"));
    const presetsPath = path.join(dir, "presets.json");
    const saved = await savePreset({
      kind: "issuer",
      name: "demo",
      data: getDemoIssuer(),
      path: presetsPath,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    const r = await createAndRenderInvoice({
      presetsPath,
      issuerPresetId: saved.preset.id,
      draft: {
        meta: { docType: "invoice" },
        client: {
          name: "Odberatel s.r.o.",
          ico: "12345678",
          address: {
            street: "Ulice 1",
            city: "Praha",
            zip: "110 00",
            country: "CZ",
          },
        },
        vat: { mode: "regular", suppliesAbroad: "none" },
        payment: { method: "transfer", variableSymbol: "1" },
        items: [
          {
            position: 1,
            description: "Prace",
            quantity: 1,
            unit: "ks",
            unitPriceWithoutVat: 1000,
            vatRate: 21,
          },
        ],
      },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pdfBase64.length).toBeGreaterThan(100);
      expect(r.isdocXml).toContain("Invoice");
      expect(r.filenamePdf).toMatch(/\.pdf$/);
    }
  });
});
