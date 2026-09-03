import { describe, expect, it } from "vitest";

import {
  WorkspaceFrozenError,
  assertNotFrozen,
  isFrozen,
} from "./workspace-freeze";

describe("isFrozen", () => {
  it("is live when frozen_at is null", () => {
    expect(isFrozen(null)).toBe(false);
  });

  it("is frozen once a timestamp is set", () => {
    expect(isFrozen(new Date("2026-09-03T10:00:00Z"))).toBe(true);
  });
});

describe("assertNotFrozen", () => {
  it("lets a live workspace through", () => {
    expect(() => assertNotFrozen(null, "ws-1")).not.toThrow();
  });

  it("fails closed with a typed error", () => {
    expect(() =>
      assertNotFrozen(new Date("2026-09-03T10:00:00Z"), "ws-1"),
    ).toThrow(WorkspaceFrozenError);
    try {
      assertNotFrozen(new Date(), "ws-1");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceFrozenError);
      if (!(error instanceof WorkspaceFrozenError)) throw error;
      expect(error.code).toBe("workspace_frozen");
      expect(error.workspaceId).toBe("ws-1");
    }
  });
});
