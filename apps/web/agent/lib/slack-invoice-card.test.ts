import { describe, expect, it } from "vitest";

import {
  formatInvoiceAmount,
  pendingCardFromToolResult,
} from "./slack-invoice-card";
import {
  actionRequestsNeedApproval,
  invoiceyActionLabel,
  invoiceyActionsLabel,
  thinkingTaskId,
  thinkingTaskIdForTool,
  truncateTypingStatus,
} from "./slack-tool-labels";

describe("pendingCardFromToolResult", () => {
  it("builds a draft invoice card with View URL", () => {
    const card = pendingCardFromToolResult("create_invoice", {
      ok: true,
      number: "2026-001",
      clientName: "NFCtron a.s.",
      total: "1210.00",
      currency: "CZK",
      invoiceId: "11111111-1111-4111-8111-111111111111",
      webUrl:
        "https://invoicey.ditrich.me/invoices/11111111-1111-4111-8111-111111111111",
    });
    expect(card).toMatchObject({
      kind: "invoice",
      title: "2026-001",
      subtitle: "NFCtron a.s.",
      webUrl:
        "https://invoicey.ditrich.me/invoices/11111111-1111-4111-8111-111111111111",
    });
    expect(card?.fields).toEqual(
      expect.arrayContaining([
        { label: "Status", value: "Draft" },
        { label: "Total", value: "1210.00 CZK" },
      ]),
    );
  });

  it("formats numeric totals from invoice-core", () => {
    expect(formatInvoiceAmount(48400, "CZK")).toBe("48400 CZK");
    const card = pendingCardFromToolResult("create_invoice", {
      ok: true,
      number: "DRAFT-1",
      clientName: "NFCtron a.s.",
      total: 48400,
      currency: "CZK",
    });
    expect(card?.fields).toEqual(
      expect.arrayContaining([{ label: "Total", value: "48400 CZK" }]),
    );
  });

  it("builds a compact list card from summaries", () => {
    const card = pendingCardFromToolResult("list_invoices", {
      ok: true,
      invoices: [
        {
          number: "2026-001",
          clientName: "Acme",
          total: "100",
          currency: "CZK",
          displayStatus: "Overdue",
        },
        {
          number: "2026-002",
          clientName: "Beta",
          total: "50",
          currency: "EUR",
          displayStatus: "Issued",
        },
      ],
    });
    expect(card?.kind).toBe("list");
    expect(card?.fields).toHaveLength(2);
    expect(card?.fields[0]).toEqual({
      label: "2026-001",
      value: "Acme · 100 CZK · Overdue",
    });
  });

  it("builds an email-sent card with recipient and view URL", () => {
    const card = pendingCardFromToolResult("send_invoice_email", {
      ok: true,
      to: "client@example.com",
      invoiceId: "22222222-2222-4222-8222-222222222222",
      webUrl:
        "https://invoicey.ditrich.me/invoices/22222222-2222-4222-8222-222222222222",
    });
    expect(card).toMatchObject({
      title: "Email sent",
      webUrl:
        "https://invoicey.ditrich.me/invoices/22222222-2222-4222-8222-222222222222",
    });
    expect(card?.fields).toEqual(
      expect.arrayContaining([
        { label: "Status", value: "Sent" },
        { label: "To", value: "client@example.com" },
      ]),
    );
  });

  it("returns null for failed tool output", () => {
    expect(
      pendingCardFromToolResult("create_invoice", {
        ok: false,
        error: "nope",
      }),
    ).toBeNull();
  });
});

describe("slack tool labels", () => {
  it("maps HITL tools and flags approval", () => {
    const issue = {
      kind: "tool-call" as const,
      callId: "1",
      toolName: "issue_invoice",
      input: {},
    };
    expect(invoiceyActionLabel(issue)).toBe("Issuing invoice…");
    expect(actionRequestsNeedApproval([issue])).toBe(true);
    expect(
      actionRequestsNeedApproval([
        {
          kind: "tool-call",
          callId: "2",
          toolName: "create_invoice",
          input: {},
        },
      ]),
    ).toBe(false);
  });

  it("truncates typing status to Slack's 50-char cap", () => {
    expect(truncateTypingStatus("Working…")).toBe("Working…");
    expect(truncateTypingStatus("a".repeat(60)).length).toBe(50);
    expect(invoiceyActionsLabel([]).length).toBeLessThanOrEqual(50);
  });

  it("collapses create_invoice retries onto one thinking task id", () => {
    expect(
      thinkingTaskId({
        kind: "tool-call",
        callId: "call-a",
        toolName: "create_invoice",
        input: {},
      }),
    ).toBe("tool:create_invoice");
    expect(thinkingTaskIdForTool("create_invoice", "call-b")).toBe(
      "tool:create_invoice",
    );
    expect(
      thinkingTaskId({
        kind: "tool-call",
        callId: "call-c",
        toolName: "search_business",
        input: {},
      }),
    ).toBe("call-c");
  });
});
