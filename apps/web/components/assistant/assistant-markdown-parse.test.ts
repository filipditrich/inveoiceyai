import { describe, expect, it } from "vitest";

import { parseAssistantMarkdown } from "./assistant-markdown-parse";

describe("parseAssistantMarkdown", () => {
  it("groups numbered lines into one ordered block", () => {
    expect(
      parseAssistantMarkdown(
        "You have **2 unpaid invoices:**\n1. **Invoice 20260119** — NFCtron a.s.\n2. **Invoice 20260120** — NFCtron Pay a.s.",
      ),
    ).toEqual([
      { kind: "paragraph", text: "You have **2 unpaid invoices:**" },
      {
        kind: "ordered",
        items: [
          "**Invoice 20260119** — NFCtron a.s.",
          "**Invoice 20260120** — NFCtron Pay a.s.",
        ],
      },
    ]);
  });

  it("groups dash bullets", () => {
    expect(parseAssistantMarkdown("- one\n- two")).toEqual([
      { kind: "bullets", items: ["one", "two"] },
    ]);
  });

  it("keeps a blank between paragraphs", () => {
    expect(parseAssistantMarkdown("alpha\n\nbeta")).toEqual([
      { kind: "paragraph", text: "alpha" },
      { kind: "blank" },
      { kind: "paragraph", text: "beta" },
    ]);
  });
});
