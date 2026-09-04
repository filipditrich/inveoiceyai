import { describe, expect, it } from "vitest";

import { contextTokensFromEvents } from "./assistant-context";

describe("contextTokensFromEvents", () => {
  it("sums every step's input — that is the Eve session budget", () => {
    expect(
      contextTokensFromEvents([
        { type: "step.completed", data: { usage: { inputTokens: 12_000 } } },
        { type: "step.completed", data: { usage: { inputTokens: 14_000 } } },
        { type: "step.completed", data: { usage: { inputTokens: 14_000 } } },
      ]),
    ).toBe(40_000);
  });

  it("reads promptTokens when inputTokens is missing", () => {
    expect(
      contextTokensFromEvents([
        { type: "step.completed", data: { usage: { promptTokens: 800 } } },
      ]),
    ).toBe(800);
  });

  it("ignores events without usage", () => {
    expect(
      contextTokensFromEvents([
        { type: "message.appended", data: { text: "hi" } },
      ]),
    ).toBe(0);
  });
});
