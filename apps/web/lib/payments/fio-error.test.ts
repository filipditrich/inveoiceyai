import { describe, expect, it } from "vitest";

import { normalizeFioError } from "./fio-error";

describe("normalizeFioError", () => {
  it("turns provider authentication failures into an actionable token error", () => {
    expect(
      normalizeFioError(
        new Error("Unsupported state or unable to authenticate data"),
      ),
    ).toBe("fio_token_inactive");
  });

  it("keeps known local error codes unchanged", () => {
    expect(normalizeFioError(new Error("fio_throttled_locally"))).toBe(
      "fio_throttled_locally",
    );
  });
});
