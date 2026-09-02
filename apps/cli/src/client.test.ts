import { describe, expect, it } from "vitest";

import {
  CompanionError,
  filenameFromDisposition,
  parseCompanionBody,
} from "./client";

describe("filenameFromDisposition", () => {
  it("prefers rfc5987", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=plain.pdf; filename*=UTF-8''faktura_2026001.pdf",
      ),
    ).toBe("faktura_2026001.pdf");
  });
});

describe("parseCompanionBody", () => {
  it("returns a JSON object", () => {
    expect(
      parseCompanionBody(200, "application/json", null, '{"ok":true}'),
    ).toEqual({ ok: true });
  });

  it("maps 401", () => {
    expect(() =>
      parseCompanionBody(401, "application/json", null, "{}"),
    ).toThrow(CompanionError);
  });

  it("surfaces HTML instead of swallowing it", () => {
    expect(() =>
      parseCompanionBody(
        200,
        "text/html; charset=utf-8",
        null,
        "<html><body>Just a moment...</body></html>",
      ),
    ).toThrow(/text\/html/);
  });

  it("names a redirect", () => {
    expect(() =>
      parseCompanionBody(307, null, "https://invoicey.ditrich.me/sign-in", ""),
    ).toThrow(/sign-in/);
  });
});
