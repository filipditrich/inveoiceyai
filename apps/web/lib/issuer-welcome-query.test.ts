import { describe, expect, it } from "vitest";

import { welcomeDoneIssuerId } from "./issuer-welcome-query";

describe("welcome done query", () => {
  it("rejects malformed ids before a workspace query", () => {
    expect(welcomeDoneIssuerId("not-a-uuid")).toBeNull();
    expect(welcomeDoneIssuerId("123")).toBeNull();
  });

  it("preserves valid current and stale candidates for the workspace-scoped lookup", () => {
    expect(welcomeDoneIssuerId("74d92c69-1471-40c2-9d3a-778718a1947e")).toBe(
      "74d92c69-1471-40c2-9d3a-778718a1947e",
    );
    expect(welcomeDoneIssuerId("0632b366-9900-4e89-aa59-1b18fcad8d58")).toBe(
      "0632b366-9900-4e89-aa59-1b18fcad8d58",
    );
  });
});
