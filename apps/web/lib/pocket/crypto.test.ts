import { describe, expect, it } from "vitest";

import {
  isPocketPkceChallenge,
  pocketPkceS256Challenge,
  verifyPocketPkceS256,
} from "./crypto";

describe("Pocket PKCE", () => {
  it("verifies RFC 7636 S256 without accepting another verifier", () => {
    const verifier = "p".repeat(64);
    const challenge = pocketPkceS256Challenge(verifier);

    expect(isPocketPkceChallenge(challenge)).toBe(true);
    expect(verifyPocketPkceS256({ verifier, challenge })).toBe(true);
    expect(verifyPocketPkceS256({ verifier: "q".repeat(64), challenge })).toBe(
      false,
    );
  });
});
