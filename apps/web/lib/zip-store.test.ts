import { describe, expect, it } from "vitest";

import { zipStore } from "./zip-store";

describe("zipStore", () => {
  it("packs store-only entries that contain the name and payload", () => {
    const payload = new Uint8Array([37, 80, 68, 70]);
    const zip = zipStore([{ name: "faktura_1.pdf", data: payload }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    const bytes = Buffer.from(zip);
    expect(bytes.includes(Buffer.from("faktura_1.pdf"))).toBe(true);
    expect(bytes.includes(Buffer.from(payload))).toBe(true);
  });

  it("keeps two files distinguishable", () => {
    const zip = zipStore([
      { name: "a.pdf", data: new Uint8Array([1]) },
      { name: "b.pdf", data: new Uint8Array([2]) },
    ]);
    const bytes = Buffer.from(zip);
    expect(bytes.includes(Buffer.from("a.pdf"))).toBe(true);
    expect(bytes.includes(Buffer.from("b.pdf"))).toBe(true);
  });
});
