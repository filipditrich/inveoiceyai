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
      bodyRotationZ: 0,
      bodyScaleX: 1,
      bodyScaleY: 1,
      eyeX: 0,
      eyeY: 0,
      eyeScaleY: 1,
      leftArmRotationZ: 0,
      legSwing: 0,
      rightArmRotationZ: 0,
      tokenPositionY: 0,
      tokenRotationY: 0,
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
    expect(pose.bodyRotationY).toBeCloseTo(0.19);
    expect(pose.bodyPositionY).toBeCloseTo(-0.12);
    expect(pose.eyeX).toBeCloseTo(0.04);
    expect(pose.eyeY).toBeCloseTo(0.03);
    expect(pose.tokenRotationY).toBeGreaterThan(0);
  });

  it("adds a celebratory hop, wave, and squash-and-stretch at the midpoint", () => {
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
    expect(pose.rightArmRotationZ).toBeLessThan(-0.15);
    expect(pose.leftArmRotationZ).toBeGreaterThan(0);
    expect(Math.abs(pose.tokenRotationZ)).toBeLessThan(0.08);
  });

  it("blinks briefly while keeping the approval check upright", () => {
    const blink = calculateInvoiceyPose({
      celebrationProgress: 0,
      elapsedSeconds: 3.75,
      pointer: { x: 0, y: 0 },
      scrollProgress: 0,
    });
    const awake = calculateInvoiceyPose({
      celebrationProgress: 0,
      elapsedSeconds: 2,
      pointer: { x: 0, y: 0 },
      scrollProgress: 0,
    });

    expect(blink.eyeScaleY).toBeLessThan(0.2);
    expect(awake.eyeScaleY).toBe(1);
    expect(Math.abs(blink.tokenRotationZ)).toBeLessThan(0.08);
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
