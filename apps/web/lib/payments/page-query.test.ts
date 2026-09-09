import { describe, expect, it } from "vitest";

import {
  pageSlice,
  parseIncomingState,
  parsePage,
  parseRequestStatus,
  paymentsSearchHref,
} from "./page-query";

describe("parseIncomingState", () => {
  it("keeps known incoming filters and falls back to all", () => {
    expect(parseIncomingState("unmatched")).toBe("unmatched");
    expect(parseIncomingState("allocated")).toBe("allocated");
    expect(parseIncomingState("nope")).toBe("all");
  });
});

describe("parseRequestStatus", () => {
  it("keeps known request statuses and falls back to all", () => {
    expect(parseRequestStatus("open")).toBe("open");
    expect(parseRequestStatus(undefined)).toBe("all");
  });
});

describe("parsePage", () => {
  it("falls back to the first page", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("nope")).toBe(1);
    expect(parsePage("0")).toBe(1);
  });
});

describe("pageSlice", () => {
  it("clamps past the last page and reports a 1-based window", () => {
    expect(pageSlice(23, 9, 10)).toEqual({
      page: 3,
      pageCount: 3,
      offset: 20,
      limit: 10,
      from: 21,
      to: 23,
    });
    expect(pageSlice(0, 1, 10)).toEqual({
      page: 1,
      pageCount: 1,
      offset: 0,
      limit: 10,
      from: 0,
      to: 0,
    });
  });
});

describe("paymentsSearchHref", () => {
  it("drops toast and default first-page keys", () => {
    expect(
      paymentsSearchHref(
        "/payments",
        { incoming: "2", toast: "ok", history: "1" },
        { incoming: "3" },
      ),
    ).toBe("/payments?incoming=3");
  });
});
