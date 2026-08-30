import { describe, expect, it } from "vitest";

import { contextTokensFromEvents } from "./assistant-context";

describe("contextTokensFromEvents", () => {
  it("keeps the latest step input count, not a sum", () => {
    expect(
      contextTokensFromEvents([
        { type: "step.completed", data: { usage: { inputTokens: 1200 } } },
        { type: "step.completed", data: { usage: { inputTokens: 3400 } } },
      ]),
    ).toBe(3400);
  });

  it("reads compaction triggers", () => {
    expect(
      contextTokensFromEvents([
        { type: "step.completed", data: { usage: { promptTokens: 800 } } },
        { type: "compaction.requested", data: { usageInputTokens: 12_000 } },
      ]),
    ).toBe(12_000);
  });

  it("ignores events without usage", () => {
    expect(
      contextTokensFromEvents([
        { type: "message.appended", data: { text: "hi" } },
      ]),
    ).toBe(0);
  });
});
