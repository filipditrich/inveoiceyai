import { describe, expect, it, vi } from "vitest";

import {
  productEventFromToast,
  productEventProperties,
  productToastTransitionFromUrl,
  trackProductEvent,
  validateProductEvent,
} from "./product-analytics";

describe("product analytics contract", () => {
  it("does not call an adapter without measurement consent", () => {
    const track = vi.fn();
    expect(
      trackProductEvent({ track }, false, "invoice_draft_saved", {
        currency: "CZK",
      }),
    ).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it("rejects sensitive and arbitrary property keys", () => {
    expect(
      validateProductEvent("invoice_draft_saved", {
        email: "person@example.com",
      } as never),
    ).toBe(false);
    expect(
      validateProductEvent("invoice_draft_saved", {
        freeText: "consulting",
      } as never),
    ).toBe(false);
  });

  it("rejects an unknown event name before it can reach an adapter", () => {
    const track = vi.fn();
    expect(validateProductEvent("untrusted_event" as never, {})).toBe(false);
    expect(
      trackProductEvent({ track }, true, "untrusted_event" as never, {}),
    ).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it("emits only allowed low-cardinality properties", () => {
    const track = vi.fn();
    expect(
      trackProductEvent({ track }, true, "invoice_draft_saved", {
        creationEntry: "structured",
        currency: "EUR",
      }),
    ).toBe(true);
    expect(track).toHaveBeenCalledWith("invoice_draft_saved", {
      creationEntry: "structured",
      currency: "EUR",
    });
  });
});

describe("successful toast transitions", () => {
  it("maps only successful redirect codes to allowlisted events", () => {
    expect(productEventFromToast("invoice_issued")).toBe("invoice_issued");
    expect(productEventFromToast("payment_confirmed")).toBe(
      "payment_match_confirmed",
    );
    expect(productEventFromToast("action_failed")).toBeNull();
  });

  it("tracks only the server toast still present in the current URL", () => {
    expect(
      productToastTransitionFromUrl("payment_confirmed", "payment_confirmed"),
    ).toBe("payment_match_confirmed");
    expect(productToastTransitionFromUrl("payment_confirmed", null)).toBeNull();
    expect(
      productToastTransitionFromUrl("payment_confirmed", "invoice_issued"),
    ).toBeNull();
  });
  it("keeps only properties allowed by the mapped event", () => {
    expect(
      productEventProperties("invoice_issued", {
        documentType: "invoice",
        currency: "CZK",
        hasIsdoc: true,
      }),
    ).toEqual({ documentType: "invoice", currency: "CZK" });
  });
  it("rejects values outside the exact low-cardinality contract", () => {
    expect(
      validateProductEvent("invoice_draft_saved", { currency: "BTC" } as never),
    ).toBe(false);
    expect(
      productEventProperties("invoice_draft_saved", {
        currency: "BTC",
        creationEntry: "structured",
      } as never),
    ).toEqual({ creationEntry: "structured" });
  });
});
