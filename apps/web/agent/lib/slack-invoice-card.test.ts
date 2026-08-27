import {
  getDemoIssuer,
  normalizeDraftToInvoice,
} from "@invoicey/invoice-tools";
import { cardToBlocks } from "eve/channels/slack";
import { describe, expect, it } from "vitest";

import { decodeAssumedMask, encodeAssumedMask } from "./invoice-card-i18n";
import { buildInvoiceCardModel } from "./invoice-card-model";
import {
  buildInvoiceModelCard,
  formatInvoiceAmount,
  pendingCardFromToolResult,
} from "./slack-invoice-card";
import {
  INVOICEY_ACTIONS,
  decodeButtonValue,
  decodeChangeValue,
  encodeButtonValue,
  encodeChangeValue,
  isInvoiceyAction,
} from "./slack-invoice-actions";
import {
  actionRequestsNeedApproval,
  actionRequestsPauseReason,
  invoiceyActionLabel,
  invoiceyActionsLabel,
  pauseNotice,
  thinkingTaskId,
  thinkingTaskIdForTool,
  truncateTypingStatus,
} from "./slack-tool-labels";

const INVOICE_ID = "11111111-1111-4111-8111-111111111111";

/** Minimal draft: everything the normalizer can default, it must default. */
function bareDraft(language?: "cs" | "en") {
  return {
    meta: language ? { language } : {},
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

function draftModel(overrides?: {
  state?: "draft" | "issued";
  language?: "cs" | "en";
}) {
  const normalized = normalizeDraftToInvoice(
    bareDraft(overrides?.language),
    getDemoIssuer(),
  );
  if (!normalized.ok) throw new Error("fixture draft failed to normalize");
  return buildInvoiceCardModel({
    invoice: normalized.invoice,
    invoiceId: INVOICE_ID,
    state: overrides?.state ?? "draft",
    assumptions: normalized.assumptions,
    webUrl: `https://invoicey.ditrich.me/invoices/${INVOICE_ID}`,
  });
}

function actionIdsOf(model: ReturnType<typeof draftModel>): string[] {
  return cardToBlocks(buildInvoiceModelCard(model))
    .filter((block) => block.type === "actions")
    .flatMap((block) => block.elements as Array<{ action_id?: string }>)
    .map((element) => element.action_id)
    .filter((id): id is string => typeof id === "string");
}

describe("buildInvoiceCardModel", () => {
  it("shows the money breakdown and tags every assumed field", () => {
    const byLabel = Object.fromEntries(
      draftModel().fields.map((f) => [f.label, f.value]),
    );

    expect(byLabel["Celkem"]).toBe("12 100,00 CZK");
    expect(byLabel["Bez DPH"]).toBe("10 000,00 CZK");
    expect(byLabel["DPH"]).toBe("2 100,00 CZK (21 %)");

    expect(byLabel["Splatnost"]).toContain("doplněno");
    expect(byLabel["Měna"]).toContain("doplněno");
    expect(byLabel["Ceny položek"]).toContain("doplněno");

    /** VAT treatment was stated, so it must not be tagged. */
    expect(byLabel["Režim DPH"]).toBe("Běžný · tuzemsko");
  });

  it("records which paths are still assumed, for the controls to carry", () => {
    const model = draftModel();
    expect(model.assumedPaths).toContain("meta.dueDate");
    expect(model.assumedPaths).toContain("meta.currency");
    expect(model.assumedPaths).not.toContain("vat");
  });

  it("keeps routine defaults out of the notice but tagged on their field", () => {
    const model = draftModel();
    const labels = model.notice.map((entry) => entry.label);
    expect(labels).toContain("Splatnost");
    expect(labels).not.toContain("Datum vystavení");

    const byLabel = Object.fromEntries(
      model.fields.map((f) => [f.label, f.value]),
    );
    expect(byLabel["Datum vystavení"]).toContain("doplněno");
  });

  it("identifies a draft by its client, not by a placeholder number", () => {
    const model = draftModel();
    expect(model.title).toBe("Návrh · NFCtron a.s.");
    expect(model.title).not.toContain("DRAFT-");
  });

  it("localizes the notice values, not just its labels", () => {
    const notice = draftModel().notice.find(
      (entry) => entry.label === "Jazyk dokladu",
    );
    /** The normalizer reports "Czech"; the card must not leak that through. */
    expect(notice?.value).toBe("čeština");
  });

  it("speaks the invoice's language", () => {
    const cs = draftModel();
    const en = draftModel({ language: "en" });

    expect(cs.locale).toBe("cs");
    expect(cs.title).toBe("Návrh · NFCtron a.s.");
    expect(cs.notice[0]?.reason).toBe("datum vystavení + 14 dní");

    expect(en.locale).toBe("en");
    expect(en.title).toBe("Draft · NFCtron a.s.");
    expect(en.fields.map((f) => f.label)).toContain("Due date");
    expect(en.notice.map((n) => n.reason)).toContain("issue date + 14 days");
  });

  it("rebuilds the notice from carried paths when the normalizer is gone", () => {
    const normalized = normalizeDraftToInvoice(bareDraft(), getDemoIssuer());
    if (!normalized.ok) throw new Error("fixture failed");

    /** What a rebuild after an edit looks like: paths, no assumptions. */
    const rebuilt = buildInvoiceCardModel({
      invoice: normalized.invoice,
      invoiceId: INVOICE_ID,
      state: "draft",
      assumedPaths: ["meta.currency", "meta.language"],
    });

    expect(rebuilt.notice.map((n) => n.label).sort()).toEqual([
      "Jazyk dokladu",
      "Měna",
    ]);
    /** The edited field is gone from both the notice and the inline tags. */
    const byLabel = Object.fromEntries(
      rebuilt.fields.map((f) => [f.label, f.value]),
    );
    expect(byLabel["Splatnost"]).not.toContain("doplněno");
    expect(byLabel["Měna"]).toContain("doplněno");
  });
});

describe("buildInvoiceModelCard", () => {
  it("gives a draft one change menu instead of four cramped selects", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const selectBlocks = blocks
      .filter((block) => block.type === "actions")
      .map((block) => block.elements as Array<Record<string, unknown>>)
      .filter((elements) => elements.some((el) => el.type === "static_select"));

    /** One actions block, one element — that is what makes it full width. */
    expect(selectBlocks).toHaveLength(1);
    expect(selectBlocks[0]).toHaveLength(1);
    expect(selectBlocks[0]?.[0]?.action_id).toBe(INVOICEY_ACTIONS.change);
  });

  it("offers every adjustment in that one menu", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const select = blocks
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<Record<string, unknown>>)
      .find((el) => el.action_id === INVOICEY_ACTIONS.change);
    const labels = (select?.options as Array<{ text: { text: string } }>).map(
      (option) => option.text.text,
    );

    expect(labels).toContain("Splatnost 30 dní");
    expect(labels).toContain("Měna EUR");
    expect(labels).toContain("Jazyk angličtina");
    expect(labels.some((l) => l.startsWith("DPH"))).toBe(true);
  });

  it("keeps every option value inside Slack's 75-character cap", () => {
    const blocks = cardToBlocks(buildInvoiceModelCard(draftModel()));
    const select = blocks
      .filter((block) => block.type === "actions")
      .flatMap((block) => block.elements as Array<Record<string, unknown>>)
      .find((el) => el.action_id === INVOICEY_ACTIONS.change);
    for (const option of select?.options as Array<{ value: string }>) {
      expect(option.value.length).toBeLessThanOrEqual(75);
    }
  });

  it("gives a draft the issue, preview and discard buttons", () => {
    const ids = actionIdsOf(draftModel());
    expect(ids).toContain(INVOICEY_ACTIONS.issue);
    expect(ids).toContain(INVOICEY_ACTIONS.previewPdf);
    expect(ids).toContain(INVOICEY_ACTIONS.discard);
    expect(ids.every(isInvoiceyAction)).toBe(true);
  });

  it("drops the draft-only controls once the invoice is issued", () => {
    const ids = actionIdsOf(draftModel({ state: "issued" }));
    expect(ids).not.toContain(INVOICEY_ACTIONS.issue);
    expect(ids).not.toContain(INVOICEY_ACTIONS.discard);
    expect(ids).not.toContain(INVOICEY_ACTIONS.change);
    expect(ids).toContain(INVOICEY_ACTIONS.markPaid);
    expect(ids).toContain(INVOICEY_ACTIONS.sendEmail);
  });

  it("warns about the assumptions worth changing, and only those", () => {
    const notice = cardToBlocks(buildInvoiceModelCard(draftModel()))
      .map((block) => JSON.stringify(block))
      .find((json) => json.includes("Doplnili jsme"));
    expect(notice).toBeDefined();
    expect(notice).toContain("Splatnost");
    expect(notice).toContain("datum vystavení + 14 dní");
    expect(notice).not.toContain("DUZP");
  });
});

describe("control value encoding", () => {
  it("round-trips the invoice, the assumed set and the chosen change", () => {
    const encoded = encodeChangeValue({
      invoiceId: INVOICE_ID,
      assumedPaths: ["meta.dueDate", "meta.currency"],
      field: "d",
      value: "30",
    });
    expect(decodeChangeValue(encoded)).toEqual({
      invoiceId: INVOICE_ID,
      assumedPaths: ["meta.dueDate", "meta.currency"],
      field: "d",
      value: "30",
    });
  });

  it("round-trips the assumed set through a button too", () => {
    const encoded = encodeButtonValue(INVOICE_ID, ["meta.language"]);
    expect(decodeButtonValue(encoded)).toEqual({
      invoiceId: INVOICE_ID,
      assumedPaths: ["meta.language"],
    });
  });

  it("packs the assumed set small enough to survive the value cap", () => {
    const all = [
      "meta.issueDate",
      "meta.dueDate",
      "meta.duzp",
      "meta.language",
      "meta.currency",
      "meta.docType",
      "pricesIncludeVat",
      "vat",
      "vat.mode",
    ];
    const mask = encodeAssumedMask(all);
    expect(mask.length).toBeLessThanOrEqual(3);
    expect(decodeAssumedMask(mask).sort()).toEqual([...all].sort());
  });

  it("ignores unknown paths rather than corrupting the mask", () => {
    expect(decodeAssumedMask(encodeAssumedMask(["nope.at.all"]))).toEqual([]);
  });

  it("rejects malformed payloads instead of guessing", () => {
    expect(decodeChangeValue(undefined)).toBeNull();
    expect(decodeChangeValue("no-separator")).toBeNull();
    expect(decodeChangeValue(`${INVOICE_ID}|0|x:1`)).toBeNull();
    expect(decodeChangeValue(`${INVOICE_ID}|0|d:`)).toBeNull();
  });

  it("claims only its own namespace", () => {
    expect(isInvoiceyAction(INVOICEY_ACTIONS.change)).toBe(true);
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
      expect.arrayContaining([{ label: "Celkem", value: "1210.00 CZK" }]),
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
      ],
    });
    expect(card?.kind).toBe("list");
    expect(card?.fields[0]).toEqual({
      label: "2026-001",
      value: "Acme · 100 CZK · Overdue",
    });
  });

  it("returns null for failed tool output", () => {
    expect(
      pendingCardFromToolResult("create_invoice", { ok: false, error: "nope" }),
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

  it("truncates typing status to Slack's 50-char cap", () => {
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
  });
});
