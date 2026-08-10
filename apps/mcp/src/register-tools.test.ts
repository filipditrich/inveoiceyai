import { jsonToolResult } from "@invoicey/invoice-tools";
import { describe, expect, it } from "vitest";

describe("jsonToolResult", () => {
  it("stringifies payload", () => {
    const r = jsonToolResult({ ok: true });
    expect(r.content[0]?.text).toContain('"ok": true');
    expect(r.isError).toBeUndefined();
  });

  it("marks errors", () => {
    const r = jsonToolResult({ ok: false }, true);
    expect(r.isError).toBe(true);
  });
});
