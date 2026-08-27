import { describe, expect, it } from "vitest";

import { calculateInvoiceyModelTransform } from "./invoicey-3d-asset";

describe("calculateInvoiceyModelTransform", () => {
  it("centers and grounds a model while preserving its proportions", () => {
    const transform = calculateInvoiceyModelTransform({
      min: { x: -0.5, y: -0.5, z: -0.2 },
      max: { x: 0.5, y: 0.5, z: 0.2 },
    });

    expect(transform.scale).toBeCloseTo(6.35);
    expect(transform.position.x).toBeCloseTo(0);
    expect(transform.position.y).toBeCloseTo(-0.025);
    expect(transform.position.z).toBeCloseTo(0);
  });

  it("rejects malformed model bounds", () => {
    expect(() =>
      calculateInvoiceyModelTransform({
        min: { x: 0, y: 1, z: 0 },
        max: { x: 1, y: 1, z: 1 },
      }),
    ).toThrow("positive finite height");
  });
});
