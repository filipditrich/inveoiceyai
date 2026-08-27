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
      bodyPositionY: 0,
      bodyRotationX: 0,
      bodyRotationY: 0,
      eyeX: 0,
      eyeY: 0,
      handLift: 0,
      tokenRotationZ: 0,
    });
  });

  it("turns toward the pointer and settles lower as the hero scrolls away", () => {
    const pose = calculateInvoiceyPose({
      celebrationProgress: 0,
      elapsedSeconds: 0,
      pointer: { x: 1, y: -1 },
      scrollProgress: 1,
    });

    expect(pose.bodyRotationX).toBeCloseTo(0.12);
    expect(pose.bodyRotationY).toBeCloseTo(0.22);
    expect(pose.bodyPositionY).toBeCloseTo(-0.12);
    expect(pose.eyeX).toBeCloseTo(0.04);
    expect(pose.eyeY).toBeCloseTo(0.03);
  });

  it("adds a celebratory hop, wave, and turn at the animation midpoint", () => {
    const pose = calculateInvoiceyPose({
      celebrationProgress: 0.5,
      elapsedSeconds: 0,
      pointer: { x: 0, y: 0 },
      scrollProgress: 0,
    });

    expect(pose.bodyPositionY).toBeCloseTo(0.32);
    expect(pose.bodyRotationY).toBeCloseTo(0);
    expect(pose.handLift).toBeCloseTo(0.45);
    expect(pose.tokenRotationZ).toBeCloseTo(Math.PI);
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
