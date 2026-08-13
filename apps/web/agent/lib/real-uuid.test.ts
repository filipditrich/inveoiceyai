import { describe, expect, it } from "vitest";

import { RealUuidSchema } from "./real-uuid";

describe("RealUuidSchema", () => {
  it("rejects nil and all-f placeholder UUIDs", () => {
    expect(
      RealUuidSchema.safeParse("00000000-0000-0000-0000-000000000000").success,
    ).toBe(false);
    expect(
      RealUuidSchema.safeParse("ffffffff-ffff-ffff-ffff-ffffffffffff").success,
    ).toBe(false);
  });

  it("accepts a normal UUID", () => {
    expect(
      RealUuidSchema.safeParse("11111111-1111-4111-8111-111111111111").success,
    ).toBe(true);
  });
});
