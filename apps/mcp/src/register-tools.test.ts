import { describe, expect, it } from "vitest";

import { jsonToolResult } from "@invoicey/invoice-tools";

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
