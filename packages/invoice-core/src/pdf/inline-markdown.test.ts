import { describe, expect, it } from "vitest";

import { parseInlineMarkdown, stripInlineMarkdown } from "./inline-markdown";

describe("parseInlineMarkdown", () => {
  it("returns plain text when no markers", () => {
    expect(parseInlineMarkdown("Hello world")).toEqual([
      { text: "Hello world", bold: false, italic: false },
    ]);
  });

  it("parses bold", () => {
    expect(parseInlineMarkdown("pay **now** please")).toEqual([
      { text: "pay ", bold: false, italic: false },
      { text: "now", bold: true, italic: false },
      { text: " please", bold: false, italic: false },
    ]);
  });

  it("parses italic with asterisk and underscore", () => {
    expect(parseInlineMarkdown("see *note* and _also_")).toEqual([
      { text: "see ", bold: false, italic: false },
      { text: "note", bold: false, italic: true },
      { text: " and ", bold: false, italic: false },
      { text: "also", bold: false, italic: true },
    ]);
  });

  it("prefers bold over single asterisk", () => {
    expect(parseInlineMarkdown("**bold**")).toEqual([
      { text: "bold", bold: true, italic: false },
    ]);
  });

  it("emits unmatched markers as plain text", () => {
    expect(parseInlineMarkdown("oops *open")).toEqual([
      { text: "oops *open", bold: false, italic: false },
    ]);
  });
});

describe("stripInlineMarkdown", () => {
  it("removes markers across lines", () => {
    expect(stripInlineMarkdown("**A**\n*B*")).toBe("A\nB");
  });
});
