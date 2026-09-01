import { describe, expect, it } from "vitest";

import {
  isPkceChallenge,
  isPkceVerifier,
  pkceS256Challenge,
  verifyPkceS256,
} from "./crypto";

describe("drive pkce", () => {
  const verifier = "a".repeat(43);

  it("accepts rfc 7636 length verifiers", () => {
    expect(isPkceVerifier(verifier)).toBe(true);
    expect(isPkceVerifier("short")).toBe(false);
    expect(isPkceChallenge(pkceS256Challenge(verifier))).toBe(true);
  });

  it("round-trips S256", () => {
    const challenge = pkceS256Challenge(verifier);
    expect(verifyPkceS256({ verifier, challenge })).toBe(true);
    expect(
      verifyPkceS256({
        verifier,
        challenge: pkceS256Challenge("b".repeat(43)),
      }),
    ).toBe(false);
  });
});
