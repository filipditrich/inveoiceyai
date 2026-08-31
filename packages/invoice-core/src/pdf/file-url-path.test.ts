import { describe, expect, it } from "vitest";

import { localPathFromFileUrl } from "./file-url-path";

describe("localPathFromFileUrl", () => {
  it("converts a file: href string", () => {
    expect(localPathFromFileUrl("file:///tmp/Inter-Regular.ttf")).toBe(
      "/tmp/Inter-Regular.ttf",
    );
  });

  it("converts a native file URL via href, not the URL object", () => {
    expect(localPathFromFileUrl(new URL("file:///tmp/Inter-Bold.ttf"))).toBe(
      "/tmp/Inter-Bold.ttf",
    );
  });

  it("converts a href-only stand-in (bundler URL objects)", () => {
    expect(localPathFromFileUrl({ href: "file:///tmp/Inter-Italic.ttf" })).toBe(
      "/tmp/Inter-Italic.ttf",
    );
  });

  it("returns null for https asset URLs instead of throwing", () => {
    expect(
      localPathFromFileUrl(new URL("https://example.com/Inter-Regular.ttf")),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(localPathFromFileUrl("")).toBeNull();
  });
});
