import { describe, expect, it } from "vitest";

import { privacySafeErrorReport } from "./observability";

describe("privacy-safe runtime reporting", () => {
  it("redacts sensitive error payloads while retaining a digest", () => {
    const error = Object.assign(
      new Error("unstructured internal failure details"),
      { digest: "abc123" },
    );
    expect(privacySafeErrorReport(error)).toEqual({
      name: "Error",
      digest: "abc123",
      category: "redacted_runtime_error",
    });
  });
});
