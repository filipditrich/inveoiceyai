import { describe, expect, it } from "vitest";

import { isSessionBudgetPrompt } from "./assistant-hitl";

describe("isSessionBudgetPrompt", () => {
  it("recognises Eve's session-budget park", () => {
    expect(
      isSessionBudgetPrompt(
        "This session has hit the input-token limit (64K) per session. This is a guardrail against defective long-running sessions. If session activity looks fine, just approve to keep going.",
      ),
    ).toBe(true);
  });

  it("does not claim an ordinary question", () => {
    expect(
      isSessionBudgetPrompt("Which issuer should I use for this draft?"),
    ).toBe(false);
  });
});
