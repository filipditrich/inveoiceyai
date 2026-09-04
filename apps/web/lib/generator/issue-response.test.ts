import { describe, expect, it } from "vitest";

import { parseIssueResponse } from "./issue-response";

describe("parseIssueResponse", () => {
  it("accepts the 200 contract", () => {
    expect(
      parseIssueResponse(200, {
        ok: true,
        invoiceId: "inv-1",
        number: "20260001",
        downloadUrl: "/api/generator/invoice/tok",
        mailed: true,
      }),
    ).toEqual({
      ok: true,
      invoiceId: "inv-1",
      number: "20260001",
      downloadUrl: "/api/generator/invoice/tok",
      mailed: true,
    });
  });

  it("maps known error codes onto gate keys", () => {
    expect(
      parseIssueResponse(422, { ok: false, error: "disposable_email" }),
    ).toEqual({
      ok: false,
      errorKey: "errorDisposable",
    });
    expect(
      parseIssueResponse(429, { ok: false, error: "allowance_exhausted" }),
    ).toEqual({ ok: false, errorKey: "errorAllowance" });
    expect(parseIssueResponse(403, { ok: false, error: "bot" })).toEqual({
      ok: false,
      errorKey: "errorBot",
    });
  });

  it("falls back by status when the body is empty", () => {
    expect(parseIssueResponse(503, null)).toEqual({
      ok: false,
      errorKey: "errorUnavailable",
    });
    expect(parseIssueResponse(429, "nope")).toEqual({
      ok: false,
      errorKey: "errorRate",
    });
  });
});
