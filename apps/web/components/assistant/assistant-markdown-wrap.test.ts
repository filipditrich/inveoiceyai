import { describe, expect, it } from "vitest";

import { wrapMarkdownSelection } from "./assistant-markdown-wrap";

describe("wrapMarkdownSelection", () => {
  it("wraps a selection in bold and unwraps the same range", () => {
    const wrapped = wrapMarkdownSelection("say hello there", 4, 9, "bold");
    expect(wrapped.value).toBe("say **hello** there");
    expect(wrapped.start).toBe(6);
    expect(wrapped.end).toBe(11);

    const unwrapped = wrapMarkdownSelection(
      wrapped.value,
      wrapped.start - 2,
      wrapped.end + 2,
      "bold",
    );
    expect(unwrapped.value).toBe("say hello there");
  });

  it("inserts an empty italic pair when nothing is selected", () => {
    const next = wrapMarkdownSelection("ab", 1, 1, "italic");
    expect(next.value).toBe("a__b");
    expect(next.start).toBe(2);
    expect(next.end).toBe(2);
  });

  it("toggles a bullet on the current line", () => {
    const listed = wrapMarkdownSelection("alpha\nbeta", 0, 5, "list");
    expect(listed.value).toBe("- alpha\nbeta");
    const cleared = wrapMarkdownSelection(
      listed.value,
      0,
      listed.value.length,
      "list",
    );
    expect(cleared.value).toBe("alpha\nbeta");
  });
});
