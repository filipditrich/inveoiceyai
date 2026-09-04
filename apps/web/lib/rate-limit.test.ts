import { describe, expect, it } from "vitest";

import {
  clientIpKey,
  createConcurrencyGate,
  createFixedWindowLimiter,
} from "./rate-limit";

describe("createFixedWindowLimiter", () => {
  it("allows up to max requests in a window", () => {
    const limiter = createFixedWindowLimiter({ windowMs: 1_000, max: 2 });
    expect(limiter.consume("a", 0)).toEqual({ ok: true });
    expect(limiter.consume("a", 10)).toEqual({ ok: true });
    expect(limiter.consume("a", 20)).toEqual({
      ok: false,
      retryAfterSeconds: 1,
    });
  });

  it("isolates keys and resets after the window", () => {
    const limiter = createFixedWindowLimiter({ windowMs: 1_000, max: 1 });
    expect(limiter.consume("a", 0)).toEqual({ ok: true });
    expect(limiter.consume("b", 0)).toEqual({ ok: true });
    expect(limiter.consume("a", 1_000)).toEqual({ ok: true });
  });
});

describe("createConcurrencyGate", () => {
  it("refuses a third enter when max is 2", () => {
    const gate = createConcurrencyGate(2);
    expect(gate.tryEnter()).toBe(true);
    expect(gate.tryEnter()).toBe(true);
    expect(gate.tryEnter()).toBe(false);
    gate.leave();
    expect(gate.tryEnter()).toBe(true);
  });
});

describe("clientIpKey", () => {
  it("prefers the first vercel forwarded hop", () => {
    const request = new Request("https://invoicey.app/", {
      headers: {
        "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      },
    });
    expect(clientIpKey(request)).toBe("1.1.1.1");
  });

  it("falls back to unknown", () => {
    expect(clientIpKey(new Request("https://invoicey.app/"))).toBe("unknown");
  });
});
