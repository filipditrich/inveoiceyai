import { describe, expect, it } from "vitest";

import { applyLookEdit } from "./apply-look-edit";
import { emptyGeneratorDraft, withPrefillNumber } from "./draft";

const ISSUER_ID = "ca8b8d4e-2e7e-4f6a-9b7d-1f9c1234abcd";
const CLIENT_ID = "5bc1d5a7-0c58-4cda-a1f6-4ad9876543ff";

function draft() {
  return withPrefillNumber(
    emptyGeneratorDraft({
      issuerId: ISSUER_ID,
      clientId: CLIENT_ID,
      locale: "cs",
    }),
  );
}

describe("applyLookEdit", () => {
  it("writes party and line fields back onto the generator draft", () => {
    let next = applyLookEdit(draft(), {
      type: "party",
      side: "issuer",
      field: "name",
      value: "Acme",
    });
    next = applyLookEdit(next, {
      type: "line",
      index: 0,
      field: "description",
      value: "Retainer",
    });
    next = applyLookEdit(next, {
      type: "line",
      index: 0,
      field: "unitPriceWithoutVat",
      value: "1000",
    });
    expect(next.issuer.name).toBe("Acme");
    expect(next.items[0]?.description).toBe("Retainer");
    expect(next.items[0]?.unitPriceWithoutVat).toBe(1000);
  });

  it("adds and removes line rows", () => {
    const added = applyLookEdit(draft(), { type: "addLine" });
    expect(added.items).toHaveLength(2);
    const removed = applyLookEdit(added, { type: "removeLine", index: 1 });
    expect(removed.items).toHaveLength(1);
  });
});
