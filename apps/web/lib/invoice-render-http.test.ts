import { describe, expect, it } from "vitest";

import { invoiceRenderParseError } from "./invoice-render-http";

describe("invoiceRenderParseError", () => {
  it("maps empty and invalid shape to 400", () => {
    expect(invoiceRenderParseError({ ok: false, error: "empty" })).toEqual({
      status: 400,
      body: { error: "empty" },
    });
    expect(
      invoiceRenderParseError({ ok: false, error: "invalid_shape" }),
    ).toEqual({
      status: 400,
      body: { error: "invalid_shape" },
    });
  });

  it("maps too_many to 413 and validation to 422", () => {
    expect(
      invoiceRenderParseError({
        ok: false,
        error: "too_many",
        limit: 25,
        count: 40,
      }),
    ).toEqual({
      status: 413,
      body: { error: "too_many", limit: 25, count: 40 },
    });
    const issues = [
      { index: 0, formErrors: [], fieldErrors: { issuer: ["required"] } },
    ];
    expect(
      invoiceRenderParseError({
        ok: false,
        error: "validation_failed",
        issues,
      }),
    ).toEqual({
      status: 422,
      body: { error: "validation_failed", issues },
    });
  });
});
