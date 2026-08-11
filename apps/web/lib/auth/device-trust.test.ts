import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createTrustTokenWithSecret,
  hashDeviceTokenWithSecret,
  verifyTrustTokenWithSecret,
} from "./device-trust-crypto";

const SECRET = "test-secret-at-least-32-characters-long!!";

describe("device trust tokens", () => {
  it("round-trips create / verify", () => {
    const raw = "device-token-abc";
    const token = createTrustTokenWithSecret(SECRET, {
      userId: "user-1",
      rawDeviceToken: raw,
    });
    const payload = verifyTrustTokenWithSecret(SECRET, token);
    expect(payload).toEqual({
      u: "user-1",
      d: raw,
      exp: expect.any(Number),
    });
    expect(hashDeviceTokenWithSecret(SECRET, raw)).toBe(
      createHmac("sha256", SECRET).update(raw).digest("hex"),
    );
  });

  it("rejects tampered tokens", () => {
    const token = createTrustTokenWithSecret(SECRET, {
      userId: "user-1",
      rawDeviceToken: "x",
    });
    expect(verifyTrustTokenWithSecret(SECRET, `${token}x`)).toBeNull();
  });
});
