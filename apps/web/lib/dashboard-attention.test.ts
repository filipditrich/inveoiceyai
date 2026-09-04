import { describe, expect, it } from "vitest";

import {
  dashboardAttentionActions,
  invoicesListHref,
} from "./dashboard-attention";

describe("invoicesListHref", () => {
  it("drops empty params so the invoices list stays unfiltered", () => {
    expect(invoicesListHref({})).toBe("/invoices");
    expect(invoicesListHref({ status: "overdue", issuerId: undefined })).toBe(
      "/invoices?status=overdue",
    );
  });
});

describe("dashboardAttentionActions", () => {
  it("orders overdue, payment matches, drafts, then unpaid and skips zeros", () => {
    expect(
      dashboardAttentionActions({
        overdueCount: 2,
        overdueTotals: { CZK: 180_000 },
        unpaidCount: 1,
        unpaidTotals: { CZK: 12_000 },
        draftCount: 3,
        pendingMatchCount: 1,
        issuerId: "iss-1",
      }),
    ).toEqual([
      {
        kind: "overdue",
        count: 2,
        totalsByCurrency: { CZK: 180_000 },
        href: "/invoices?status=overdue&issuerId=iss-1",
      },
      {
        kind: "matches",
        count: 1,
        totalsByCurrency: {},
        href: "/payments",
      },
      {
        kind: "drafts",
        count: 3,
        totalsByCurrency: {},
        href: "/invoices?status=draft&issuerId=iss-1",
      },
      {
        kind: "unpaid",
        count: 1,
        totalsByCurrency: { CZK: 12_000 },
        href: "/invoices?status=unpaid&issuerId=iss-1",
      },
    ]);
  });

  it("returns no actions when the workspace is caught up", () => {
    expect(
      dashboardAttentionActions({
        overdueCount: 0,
        overdueTotals: {},
        unpaidCount: 0,
        unpaidTotals: {},
        draftCount: 0,
        pendingMatchCount: 0,
      }),
    ).toEqual([]);
  });
});
