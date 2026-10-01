import { describe, expect, it } from "vitest";

import { jsonToolResult } from "@invoicey/invoice-tools";

describe("jsonToolResult", () => {
  it("escapes invoice text without changing the parsed JSON payload", () => {
    const r = jsonToolResult({ ok: true, notes: 'Řádek "jeden"\nDruhý řádek' });
    expect(JSON.parse(r.content[0].text)).toEqual({
      ok: true,
      notes: 'Řádek "jeden"\nDruhý řádek',
    });
    expect(r.isError).toBeUndefined();
  });

  it("marks errors", () => {
    const r = jsonToolResult({ ok: false }, true);
    expect(r.isError).toBe(true);
  });
});
