import {
  AppBuildInfoSchema,
  isBuildStale,
  UNKNOWN_GIT_SHA,
} from "@/lib/app-build-info";
import { describe, expect, it } from "vitest";

describe("AppBuildInfoSchema", () => {
  it("returns version and sha from a valid payload", () => {
    expect(
      AppBuildInfoSchema.parse({ version: "1.46.0", sha: "a1b2c3d" }),
    ).toEqual({
      version: "1.46.0",
      sha: "a1b2c3d",
    });
  });

  it("trims whitespace", () => {
    expect(
      AppBuildInfoSchema.parse({ version: " 1.46.0 ", sha: " a1b2c3d " }),
    ).toEqual({ version: "1.46.0", sha: "a1b2c3d" });
  });

  it("rejects missing fields", () => {
    expect(AppBuildInfoSchema.safeParse({ version: "1.46.0" }).success).toBe(
      false,
    );
    expect(AppBuildInfoSchema.safeParse({ sha: "a1b2c3d" }).success).toBe(
      false,
    );
    expect(AppBuildInfoSchema.safeParse(null).success).toBe(false);
    expect(AppBuildInfoSchema.safeParse("1.46.0").success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(
      AppBuildInfoSchema.safeParse({ version: "", sha: "a1b2c3d" }).success,
    ).toBe(false);
    expect(
      AppBuildInfoSchema.safeParse({ version: "1.46.0", sha: "  " }).success,
    ).toBe(false);
  });
});

describe("isBuildStale", () => {
  it("is false when shas match", () => {
    expect(isBuildStale({ runningSha: "a1b2c3d", liveSha: "a1b2c3d" })).toBe(
      false,
    );
  });

  it("is true when shas differ", () => {
    expect(isBuildStale({ runningSha: "a1b2c3d", liveSha: "b2c3d4e" })).toBe(
      true,
    );
  });

  it("treats a short sha as current when it prefixes the live sha", () => {
    expect(
      isBuildStale({
        runningSha: "a1b2c3d",
        liveSha: "a1b2c3def0123456789",
      }),
    ).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isBuildStale({ runningSha: "A1B2C3D", liveSha: "a1b2c3d" })).toBe(
      false,
    );
  });

  it("is false when either side is the unknown placeholder", () => {
    expect(
      isBuildStale({ runningSha: UNKNOWN_GIT_SHA, liveSha: "a1b2c3d" }),
    ).toBe(false);
    expect(
      isBuildStale({ runningSha: "a1b2c3d", liveSha: UNKNOWN_GIT_SHA }),
    ).toBe(false);
  });

  it("is false when a sha is shorter than a git short sha", () => {
    expect(isBuildStale({ runningSha: "abc", liveSha: "a1b2c3d" })).toBe(false);
  });
});
