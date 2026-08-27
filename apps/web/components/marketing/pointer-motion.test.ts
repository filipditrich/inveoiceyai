import { describe, expect, it } from "vitest";

import {
  normalizePointerPosition,
  shouldShowFloatingGuide,
} from "./pointer-motion";

const stage = { left: 100, top: 50, width: 400, height: 200 };

describe("normalizePointerPosition", () => {
  it("maps the center of a stage to a neutral position", () => {
    expect(normalizePointerPosition({ x: 300, y: 150 }, stage)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("maps stage edges to the full motion range", () => {
    expect(normalizePointerPosition({ x: 100, y: 50 }, stage)).toEqual({
      x: -1,
      y: -1,
    });
    expect(normalizePointerPosition({ x: 500, y: 250 }, stage)).toEqual({
      x: 1,
      y: 1,
    });
  });

  it("clamps positions outside the stage", () => {
    expect(normalizePointerPosition({ x: -500, y: 900 }, stage)).toEqual({
      x: -1,
      y: 1,
    });
  });
});

describe("shouldShowFloatingGuide", () => {
  const page = {
    documentHeight: 6_200,
    viewportHeight: 720,
    wideScreen: true,
  };

  it("shows after the hero while enough page remains", () => {
    expect(shouldShowFloatingGuide({ ...page, scrollY: 900 })).toBe(true);
  });

  it("stays out of the hero, mobile layouts, and the footer", () => {
    expect(shouldShowFloatingGuide({ ...page, scrollY: 300 })).toBe(false);
    expect(
      shouldShowFloatingGuide({ ...page, scrollY: 900, wideScreen: false }),
    ).toBe(false);
    expect(shouldShowFloatingGuide({ ...page, scrollY: 5_000 })).toBe(false);
  });
});
