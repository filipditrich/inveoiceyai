import { describe, expect, it } from "vitest";

import {
  calculateInvoiceyPose,
  resolveCelebrationProgress,
} from "./invoicey-3d-motion";

describe("calculateInvoiceyPose", () => {
  it("keeps the character neutral when there is no input", () => {
    expect(
      calculateInvoiceyPose({
        celebrationProgress: 0,
        elapsedSeconds: 0,
        pointer: { x: 0, y: 0 },
        scrollProgress: 0,
      }),
    ).toEqual({
      bodyPositionX: 0,
      bodyPositionY: 0,
      bodyRotationX: 0,
      bodyRotationY: 0,
      bodyRotationZ: 0,
      bodyScaleX: 1,
      bodyScaleY: 1,
      shadowOpacity: 0.1,
      shadowScale: 1,
    });
  });

  it("turns toward the pointer and settles lower as the hero scrolls away", () => {
    const pose = calculateInvoiceyPose({
      celebrationProgress: 0,
      elapsedSeconds: 0,
      pointer: { x: 1, y: -1 },
      scrollProgress: 1,
    });

    expect(pose.bodyRotationX).toBeCloseTo(0.09);
    expect(pose.bodyRotationY).toBeCloseTo(0.15);
    expect(pose.bodyPositionY).toBeCloseTo(-0.12);
    expect(pose.bodyPositionX).toBeCloseTo(0.07);
  });

  it("adds a celebratory hop and squash-and-stretch at the midpoint", () => {
    const pose = calculateInvoiceyPose({
      celebrationProgress: 0.5,
      elapsedSeconds: 0,
      pointer: { x: 0, y: 0 },
      scrollProgress: 0,
    });

    expect(pose.bodyPositionY).toBeCloseTo(0.32);
    expect(pose.bodyRotationY).toBeCloseTo(0);
    expect(pose.bodyScaleX).toBeLessThan(1);
    expect(pose.bodyScaleY).toBeGreaterThan(1);
    expect(pose.shadowOpacity).toBeLessThan(0.1);
    expect(pose.shadowScale).toBeLessThan(1);
  });
});

describe("resolveCelebrationProgress", () => {
  it("returns a bounded phase and resets after the celebration", () => {
    expect(resolveCelebrationProgress(1_000, null)).toBe(0);
    expect(resolveCelebrationProgress(1_000, 1_000)).toBe(0);
    expect(resolveCelebrationProgress(1_600, 1_000)).toBeCloseTo(0.5);
    expect(resolveCelebrationProgress(2_200, 1_000)).toBe(0);
  });
});
