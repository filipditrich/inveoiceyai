import {
  getDemoIssuer,
  normalizeDraftToInvoice,
} from "@invoicey/invoice-tools";
import { cardToBlocks } from "eve/channels/slack";
import { describe, expect, it } from "vitest";

import { buildInvoiceCardModel } from "./invoice-card-model";
import {
  buildInvoiceModelCard,
  formatInvoiceAmount,
  pendingCardFromToolResult,
} from "./slack-invoice-card";
import {
  INVOICEY_ACTIONS,
  decodeSelectValue,
  encodeSelectValue,
  isInvoiceyAction,
} from "./slack-invoice-actions";
import {
  actionRequestsNeedApproval,
  actionRequestsPauseReason,
  invoiceyActionLabel,
  invoiceyActionsLabel,
  thinkingTaskId,
  pauseNotice,
  thinkingTaskIdForTool,
  truncateTypingStatus,
} from "./slack-tool-labels";

const INVOICE_ID = "11111111-1111-4111-8111-111111111111";

/** Minimal draft: everything the normalizer can default, it must default. */
function bareDraft() {
  return {
    meta: {},
    client: {
      name: "NFCtron a.s.",
      ico: "08453961",
      dic: "CZ08453961",
      address: {
        street: "Nákupní 1",
        city: "Ostrava",
        zip: "709 00",
        country: "CZ",
      },
    },
    vat: { mode: "regular", suppliesAbroad: "none" },
    payment: { method: "transfer" },
    items: [
      {
        position: 1,
        description: "Web development",
        quantity: 10,
        unit: "hod",
        unitPriceWithoutVat: 1_000,
        vatRate: 21,
      },
    ],
  };
}

function draftModel(overrides?: { state?: "draft" | "issued" }) {
  const normalized = normalizeDraftToInvoice(bareDraft(), getDemoIssuer());
  if (!normalized.ok) throw new Error("fixture draft failed to normalize");
  return buildInvoiceCardModel({
    invoice: normalized.invoice,
    invoiceId: INVOICE_ID,
    state: overrides?.state ?? "draft",
    assumptions: normalized.assumptions,
    webUrl: `https://invoicey.ditrich.me/invoices/${INVOICE_ID}`,
  });
}

describe("buildInvoiceCardModel", () => {
  it("shows the money breakdown and tags every assumed field", () => {
    const model = draftModel();
    const byLabel = Object.fromEntries(
      model.fields.map((field) => [field.label, field.value]),
    );

    expect(byLabel.Total).toBe("12 100,00 CZK");
    expect(byLabel["Excl. VAT"]).toBe("10 000,00 CZK");
    expect(byLabel.VAT).toBe("2 100,00 CZK (21 %)");

    /** The four the user never stated must be visibly marked. */
    expect(byLabel["Due date"]).toContain("assumed");
    expect(byLabel.Currency).toContain("assumed");
    expect(byLabel.Language).toContain("assumed");
    expect(byLabel["Line prices"]).toContain("assumed");

    /** VAT treatment was stated, so it must not be. */
    expect(byLabel["VAT treatment"]).toBe("Regular · domestic");
  });

  it("carries the reasons so the card can explain itself", () => {
    const model = draftModel();
    const due = model.assumptions.find((a) => a.path === "meta.dueDate");
    expect(due).toMatchObject({
      label: "Due date",
      reason: "issue date + 14 days",
    });
  });

  it("identifies a draft by its client, not by a placeholder number", () => {
    const model = draftModel();
    expect(model.title).toBe("Draft · NFCtron a.s.");
    expect(model.title).not.toContain("DRAFT-");
    expect(model.subtitle).toBe("Invoice · IČO 08453961 · 12 100,00 CZK");
  });

  it("leads with the real number once the invoice is issued", () => {
    const model = draftModel({ state: "issued" });
    expect(model.title).toContain("NFCtron a.s.");
    expect(model.subtitle).toContain("Issued");
  });

  it("renders line items with quantities and unit prices", () => {
    expect(draftModel().linesText).toContain(
      "1. Web development · 10 hod × 1 000,00 CZK = 10 000,00 CZK",
    );
  });
});

describe("buildInvoiceModelCard", () => {
  it("gives a draft the issue, preview, discard and adjust controls", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const actionIds = blocks
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<{ action_id?: string }>)
      .map((element) => element.action_id)
      .filter((id): id is string => typeof id === "string");

    expect(actionIds).toContain(INVOICEY_ACTIONS.issue);
    expect(actionIds).toContain(INVOICEY_ACTIONS.previewPdf);
    expect(actionIds).toContain(INVOICEY_ACTIONS.discard);
    expect(actionIds).toContain(INVOICEY_ACTIONS.setDue);
    expect(actionIds).toContain(INVOICEY_ACTIONS.setCurrency);
    expect(actionIds).toContain(INVOICEY_ACTIONS.setVat);
    expect(actionIds).toContain(INVOICEY_ACTIONS.setLanguage);
    expect(actionIds.every(isInvoiceyAction)).toBe(true);
  });

  it("drops the draft-only controls once the invoice is issued", () => {
    const blocks = cardToBlocks(
      buildInvoiceModelCard(draftModel({ state: "issued" })),
    );
    const actionIds = blocks
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<{ action_id?: string }>)
      .map((element) => element.action_id);

    expect(actionIds).not.toContain(INVOICEY_ACTIONS.issue);
    expect(actionIds).not.toContain(INVOICEY_ACTIONS.discard);
    expect(actionIds).not.toContain(INVOICEY_ACTIONS.setCurrency);
    expect(actionIds).toContain(INVOICEY_ACTIONS.markPaid);
    expect(actionIds).toContain(INVOICEY_ACTIONS.sendEmail);
  });

  it("preselects the current due-date preset so the select is not misleading", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const dueSelect = blocks
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<Record<string, unknown>>)
      .find((element) => element.action_id === INVOICEY_ACTIONS.setDue);

    /** The fixture draft defaults to +14 days. */
    const initial = dueSelect?.initial_option as { value: string } | undefined;
    expect(decodeSelectValue(initial?.value)).toEqual({
      invoiceId: INVOICE_ID,
      value: "14",
    });
  });

  it("warns about the assumptions worth changing, and only those", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const notice = blocks
      .map((block) => JSON.stringify(block))
      .find((json) => json.includes("Assumed"));
    expect(notice).toBeDefined();

    /** Worth a warning: the user loses money or credibility if these are wrong. */
    expect(notice).toContain("Due date");
    expect(notice).toContain("issue date + 14 days");
    expect(notice).toContain("Currency");
    expect(notice).toContain("Line prices");

    /** Routine: correct almost always, and already tagged on the field itself. */
    expect(notice).not.toContain("DUZP");
    expect(notice).not.toContain("Document type");
  });

  it("still tags routine defaults on the field they belong to", () => {
    const byLabel = Object.fromEntries(
      draftModel().fields.map((f) => [f.label, f.value]),
    );
    expect(byLabel["Issue date"]).toContain("assumed");
  });
});

describe("select value encoding", () => {
  it("round-trips the invoice id alongside the chosen value", () => {
    expect(decodeSelectValue(encodeSelectValue(INVOICE_ID, "30"))).toEqual({
      invoiceId: INVOICE_ID,
      value: "30",
    });
  });

  it("keeps a value that itself contains the separator intact", () => {
    expect(
      decodeSelectValue(encodeSelectValue(INVOICE_ID, "reverse_charge|eu")),
    ).toEqual({ invoiceId: INVOICE_ID, value: "reverse_charge|eu" });
  });

  it("rejects malformed payloads instead of guessing", () => {
    expect(decodeSelectValue(undefined)).toBeNull();
    expect(decodeSelectValue("no-separator")).toBeNull();
    expect(decodeSelectValue("|orphan")).toBeNull();
  });

  it("claims only its own namespace", () => {
    expect(isInvoiceyAction(INVOICEY_ACTIONS.issue)).toBe(true);
    expect(isInvoiceyAction("eve_input:abc")).toBe(false);
    expect(isInvoiceyAction("eve_input_freeform:abc")).toBe(false);
  });
});

describe("pendingCardFromToolResult", () => {
  it("adopts the card model a tool attached to its result", () => {
    const model = draftModel();
    const card = pendingCardFromToolResult("create_invoice", {
      ok: true,
      invoiceId: INVOICE_ID,
      card: model,
    });
    expect(card?.model).toEqual(model);
    expect(card?.title).toBe(model.title);
  });

  it("accepts the same model from the edit tool", () => {
    const card = pendingCardFromToolResult("update_invoice_draft", {
      ok: true,
      card: draftModel(),
    });
    expect(card?.model?.state).toBe("draft");
  });

  it("falls back to the flat summary when a tool sends no model", () => {
    const card = pendingCardFromToolResult("get_invoice", {
      ok: true,
      summary: {
        number: "2026-001",
        clientName: "NFCtron a.s.",
        total: "1210.00",
        currency: "CZK",
        displayStatus: "Issued",
      },
      webUrl: `https://invoicey.ditrich.me/invoices/${INVOICE_ID}`,
    });
    expect(card?.model).toBeUndefined();
    expect(card?.fields).toEqual(
      expect.arrayContaining([{ label: "Total", value: "1210.00 CZK" }]),
    );
  });

  it("formats numeric totals from invoice-core", () => {
    expect(formatInvoiceAmount(48400, "CZK")).toBe("48400 CZK");
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

  it("distinguishes a question from an approval when parking the turn", () => {
    const ask = {
      kind: "tool-call" as const,
      callId: "q1",
      toolName: "ask_question",
      input: {},
    };
    const issue = {
      kind: "tool-call" as const,
      callId: "i1",
      toolName: "issue_invoice",
      input: {},
    };

    expect(actionRequestsPauseReason([ask])).toBe("question");
    expect(pauseNotice("question")).toBe("Waiting for your answer…");

    expect(actionRequestsPauseReason([issue])).toBe("approval");
    expect(pauseNotice("approval")).toBe("Waiting for approval…");

    /** An approval in the same batch outranks a question — it blocks harder. */
    expect(actionRequestsPauseReason([ask, issue])).toBe("approval");

    expect(
      actionRequestsPauseReason([
        {
          kind: "tool-call",
          callId: "s1",
          toolName: "search_business",
          input: {},
        },
      ]),
    ).toBeNull();
  });

  it("labels the question tool so the step is not a raw tool name", () => {
    expect(
      invoiceyActionLabel({
        kind: "tool-call",
        callId: "q2",
        toolName: "ask_question",
        input: {},
      }),
    ).toBe("Asking you…");
  });

  it("labels the draft-edit tool", () => {
    expect(
      invoiceyActionLabel({
        kind: "tool-call",
        callId: "3",
        toolName: "update_invoice_draft",
        input: {},
      }),
    ).toBe("Updating draft…");
  });

  it("truncates typing status to Slack's 50-char cap", () => {
    expect(truncateTypingStatus("Working…")).toBe("Working…");
    expect(truncateTypingStatus("a".repeat(60)).length).toBe(50);
    expect(invoiceyActionsLabel([]).length).toBeLessThanOrEqual(50);
  });

  it("collapses draft retries onto one thinking task id", () => {
    expect(
      thinkingTaskId({
        kind: "tool-call",
        callId: "call-a",
        toolName: "create_invoice",
        input: {},
      }),
    ).toBe("tool:create_invoice");
    expect(thinkingTaskIdForTool("update_invoice_draft", "call-b")).toBe(
      "tool:update_invoice_draft",
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
