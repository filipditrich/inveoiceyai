import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseAmountCz } from "@/lib/slack/parse-amount-cz";
import { verifySlackRequest } from "@/lib/slack/verify-slack-request";

describe("parseAmountCz", () => {
  it("parses spaced thousands with Kč", () => {
    expect(parseAmountCz("50 000 Kč")).toEqual({ ok: true, amount: 50_000 });
  });

  it("parses Czech comma decimal", () => {
    expect(parseAmountCz("1.000,50")).toEqual({ ok: true, amount: 1000.5 });
  });

  it("rejects empty", () => {
    expect(parseAmountCz("   ")).toEqual({ ok: false });
  });
});

describe("verifySlackRequest", () => {
  it("rejects missing signature", () => {
    expect(
      verifySlackRequest({
        signingSecret: "s",
        rawBody: "a=1",
        timestamp: "1",
        signature: null,
      }),
    ).toBe(false);
  });

  it("accepts a valid v0 signature", () => {
    const signingSecret = "test_secret";
    const rawBody = "command=%2Finvoice&text=hello";
    const nowSec = 1_700_000_000;
    const timestamp = String(nowSec);
    const base = `v0:${timestamp}:${rawBody}`;
    const hmac = createHmac("sha256", signingSecret)
      .update(base, "utf8")
      .digest("hex");
    const signature = `v0=${hmac}`;

    expect(
      verifySlackRequest({
        signingSecret,
        rawBody,
        timestamp,
        signature,
        nowSec,
      }),
    ).toBe(true);
  });
});
