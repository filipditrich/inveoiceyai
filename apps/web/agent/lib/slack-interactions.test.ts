import { beforeEach, describe, expect, it, vi } from "vitest";

const ops = vi.hoisted(() => ({
  getInvoice: vi.fn(),
  issueInvoiceById: vi.fn(),
  markInvoicePaidById: vi.fn(),
  bulkDeleteDraftInvoices: vi.fn(),
  updateDraftInvoice: vi.fn(),
  sendInvoiceEmailById: vi.fn(),
  resolveLinkedSlackPrincipal: vi.fn(),
  renderInvoicePdf: vi.fn(),
  renderIsdoc: vi.fn(),
  uploadInvoiceArtifacts: vi.fn(),
}));

vi.mock("@invoicey/db", () => ({
  tryCreateDbFromEnv: () => ({}),
  resolveLinkedSlackPrincipal: ops.resolveLinkedSlackPrincipal,
}));

vi.mock("@invoicey/invoice-tools/ops", () => ({
  getInvoice: ops.getInvoice,
  issueInvoiceById: ops.issueInvoiceById,
  markInvoicePaidById: ops.markInvoicePaidById,
  bulkDeleteDraftInvoices: ops.bulkDeleteDraftInvoices,
  invoiceForPdfRender: async (invoice: unknown) => invoice,
}));

vi.mock("@invoicey/invoice-tools", () => ({
  updateDraftInvoice: ops.updateDraftInvoice,
  addCalendarDaysYmd: (iso: string, days: number) => {
    const base = new Date(`${iso}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  },
  formatVatIntent: (vat: { mode: string; suppliesAbroad: string }) =>
    `${vat.mode} · ${vat.suppliesAbroad}`,
}));

vi.mock("@invoicey/invoice-tools/email", () => ({
  sendInvoiceEmailById: ops.sendInvoiceEmailById,
}));

vi.mock("@invoicey/invoice-tools/workspace-context", () => ({
  runWithInvoiceyContext: <T>(_ctx: unknown, fn: () => T) => fn(),
}));

vi.mock("@invoicey/invoice-core", () => ({
  renderInvoicePdf: ops.renderInvoicePdf,
  renderIsdoc: ops.renderIsdoc,
}));

vi.mock("./upload-slack-files", () => ({
  uploadInvoiceArtifacts: ops.uploadInvoiceArtifacts,
}));

const { handleInvoiceyInteraction } = await import("./slack-interactions");
const { INVOICEY_ACTIONS, encodeButtonValue, encodeChangeValue } =
  await import("./slack-invoice-actions");

const INVOICE_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_TS = "1700000000.000100";

function fakeInvoice() {
  return {
    meta: {
      number: "DRAFT-1",
      docType: "invoice",
      issueDate: "2026-08-26",
      dueDate: "2026-09-09",
      duzp: "2026-08-26",
      currency: "CZK",
      language: "cs",
    },
    issuer: { name: "Test Issuer", vatPayer: true },
    client: { name: "NFCtron a.s.", ico: "08453961" },
    vat: { mode: "regular", suppliesAbroad: "none" },
    payment: { method: "transfer" },
    items: [
      {
        position: 1,
        description: "Web",
        quantity: 1,
        unit: "ks",
        unitPriceWithoutVat: 100,
        vatRate: 21,
        lineSubtotal: 100,
        lineVat: 21,
        lineTotal: 121,
      },
    ],
    totals: { subtotal: 100, vatTotal: 21, total: 121, vatBreakdown: [] },
  };
}

function makeCtx() {
  const request = vi.fn().mockResolvedValue({ ok: true });
  const postEphemeral = vi.fn().mockResolvedValue({});
  return {
    ctx: {
      slack: { channelId: "C1", threadTs: "T1", teamId: "TEAM1", request },
      thread: { postEphemeral },
    } as never,
    request,
    postEphemeral,
  };
}

function buttonClick(
  actionId: string,
  assumedPaths: string[] = ["meta.currency"],
) {
  return {
    actionId,
    value: encodeButtonValue(INVOICE_ID, assumedPaths),
    messageTs: MESSAGE_TS,
    user: { id: "U123" },
  } as never;
}

function changeClick(
  field: "d" | "c" | "l" | "v",
  value: string,
  assumedPaths: string[] = ["meta.dueDate", "meta.currency", "meta.language"],
) {
  return {
    actionId: INVOICEY_ACTIONS.change,
    selectedOptionValue: encodeChangeValue({
      invoiceId: INVOICE_ID,
      assumedPaths,
      field,
      value,
    }),
    messageTs: MESSAGE_TS,
    user: { id: "U123" },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  ops.resolveLinkedSlackPrincipal.mockResolvedValue({
    status: "linked",
    identity: { workspaceId: "W1", userId: "U-invoicey" },
  });
  ops.getInvoice.mockResolvedValue({
    ok: true,
    summary: { issuedAt: null, paidAt: null, cancelledAt: null },
    invoice: fakeInvoice(),
  });
  ops.updateDraftInvoice.mockResolvedValue({
    ok: true,
    invoice: fakeInvoice(),
    invoiceId: INVOICE_ID,
    assumptions: [],
  });
});

describe("handleInvoiceyInteraction: gating", () => {
  it("ignores action ids outside its namespace", async () => {
    const { ctx } = makeCtx();
    await handleInvoiceyInteraction(buttonClick("eve_input:req-1"), ctx);
    expect(ops.resolveLinkedSlackPrincipal).not.toHaveBeenCalled();
  });

  it("treats the web link button as a no-op, not a broken click", async () => {
    const { ctx, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(
      { actionId: INVOICEY_ACTIONS.openWeb, user: { id: "U123" } } as never,
      ctx,
    );
    expect(postEphemeral).not.toHaveBeenCalled();
    expect(ops.resolveLinkedSlackPrincipal).not.toHaveBeenCalled();
  });

  it("refuses to act for an unlinked Slack user", async () => {
    ops.resolveLinkedSlackPrincipal.mockResolvedValue({ status: "unlinked" });
    const { ctx, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(buttonClick(INVOICEY_ACTIONS.issue), ctx);
    expect(ops.issueInvoiceById).not.toHaveBeenCalled();
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("není propojený"),
    );
  });

  it("reports privately rather than in-channel when a click is malformed", async () => {
    const { ctx, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(
      { actionId: INVOICEY_ACTIONS.issue, user: { id: "U123" } } as never,
      ctx,
    );
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("chybí odkaz na fakturu"),
    );
  });
});

describe("handleInvoiceyInteraction: draft edits", () => {
  it("turns a due-date preset into an absolute date off the issue date", async () => {
    const { ctx } = makeCtx();
    await handleInvoiceyInteraction(changeClick("d", "30"), ctx);
    expect(ops.updateDraftInvoice).toHaveBeenCalledWith({
      id: INVOICE_ID,
      patch: { meta: { dueDate: "2026-09-25" } },
    });
  });

  it("patches currency and language straight through", async () => {
    const { ctx } = makeCtx();
    await handleInvoiceyInteraction(changeClick("c", "EUR"), ctx);
    expect(ops.updateDraftInvoice).toHaveBeenCalledWith({
      id: INVOICE_ID,
      patch: { meta: { currency: "EUR" } },
    });

    await handleInvoiceyInteraction(changeClick("l", "en"), ctx);
    expect(ops.updateDraftInvoice).toHaveBeenLastCalledWith({
      id: INVOICE_ID,
      patch: { meta: { language: "en" } },
    });
  });

  it("expands the compact VAT code into mode and supplies", async () => {
    const { ctx } = makeCtx();
    await handleInvoiceyInteraction(changeClick("v", "rc-eu"), ctx);
    expect(ops.updateDraftInvoice).toHaveBeenCalledWith({
      id: INVOICE_ID,
      patch: { vat: { mode: "reverse_charge", suppliesAbroad: "eu" } },
    });
  });

  it("edits the clicked card in place instead of posting a new one", async () => {
    const { ctx, request } = makeCtx();
    await handleInvoiceyInteraction(changeClick("c", "EUR"), ctx);
    expect(request).toHaveBeenCalledWith(
      "chat.update",
      expect.objectContaining({ channel: "C1", ts: MESSAGE_TS }),
    );
  });

  it("keeps the other fields flagged after editing one of them", async () => {
    const { ctx, request } = makeCtx();
    await handleInvoiceyInteraction(
      changeClick("d", "30", [
        "meta.dueDate",
        "meta.currency",
        "meta.language",
      ]),
      ctx,
    );

    const update = request.mock.calls.find((call) => call[0] === "chat.update");
    const blocks = (update?.[1] as { blocks: Array<Record<string, unknown>> })
      .blocks;
    const notice = blocks
      .map((block) => JSON.stringify(block))
      .find((json) => json.includes("Doplnili jsme"));

    /** The edited field drops out of the warning... */
    expect(notice).not.toContain("Splatnost");
    /** ...while the ones the user still has not stated stay in it. */
    expect(notice).toContain("Měna");
    expect(notice).toContain("Jazyk dokladu");
  });

  it("surfaces a rejected edit to the clicker and leaves the card alone", async () => {
    ops.updateDraftInvoice.mockResolvedValue({
      ok: false,
      issues: [{ path: "vat.suppliesAbroad", message: "oss requires abroad" }],
    });
    const { ctx, request, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(changeClick("v", "o-eu"), ctx);
    expect(request).not.toHaveBeenCalled();
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("oss requires abroad"),
    );
  });
});

describe("handleInvoiceyInteraction: lifecycle actions", () => {
  it("issues, then uploads the frozen artifacts", async () => {
    ops.issueInvoiceById.mockResolvedValue({
      ok: true,
      alreadyIssued: false,
      invoice: {
        ...fakeInvoice(),
        meta: { ...fakeInvoice().meta, number: "2026-001" },
      },
      summary: { issuedAt: "2026-08-26", paidAt: null, cancelledAt: null },
    });
    ops.renderInvoicePdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    ops.renderIsdoc.mockReturnValue("<xml/>");
    ops.getInvoice.mockResolvedValue({
      ok: true,
      summary: { issuedAt: "2026-08-26", paidAt: null, cancelledAt: null },
      invoice: fakeInvoice(),
    });

    const { ctx, request } = makeCtx();
    await handleInvoiceyInteraction(buttonClick(INVOICEY_ACTIONS.issue), ctx);

    expect(ops.issueInvoiceById).toHaveBeenCalledWith({ id: INVOICE_ID });
    expect(request).toHaveBeenCalledWith("chat.update", expect.anything());
    expect(ops.uploadInvoiceArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "C1", threadTs: "T1" }),
    );
  });

  it("does not upload anything when issuing fails", async () => {
    ops.issueInvoiceById.mockResolvedValue({
      ok: false,
      error: "numbering scheme missing",
    });
    const { ctx, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(buttonClick(INVOICEY_ACTIONS.issue), ctx);

    expect(ops.uploadInvoiceArtifacts).not.toHaveBeenCalled();
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("numbering scheme missing"),
    );
  });

  it("discards a draft and replaces the card with a tombstone", async () => {
    ops.bulkDeleteDraftInvoices.mockResolvedValue({
      ok: 1,
      skipped: 0,
      failed: 0,
    });
    const { ctx, request } = makeCtx();
    await handleInvoiceyInteraction(buttonClick(INVOICEY_ACTIONS.discard), ctx);

    expect(ops.bulkDeleteDraftInvoices).toHaveBeenCalledWith({
      ids: [INVOICE_ID],
    });
    const update = request.mock.calls.find((c) => c[0] === "chat.update");
    expect(JSON.stringify(update?.[1])).toContain("Zahozeno");
  });

  it("refuses to pretend a blocked discard worked", async () => {
    ops.bulkDeleteDraftInvoices.mockResolvedValue({
      ok: 0,
      skipped: 1,
      failed: 0,
    });
    const { ctx, request, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(buttonClick(INVOICEY_ACTIONS.discard), ctx);
    expect(request).not.toHaveBeenCalled();
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("už je vystavený"),
    );
  });

  it("explains a missing recipient instead of echoing an error code", async () => {
    ops.sendInvoiceEmailById.mockResolvedValue({
      ok: false,
      error: "missing_recipient",
    });
    const { ctx, postEphemeral } = makeCtx();
    await handleInvoiceyInteraction(
      buttonClick(INVOICEY_ACTIONS.sendEmail),
      ctx,
    );
    expect(postEphemeral).toHaveBeenCalledWith(
      "U123",
      expect.stringContaining("nemá uložený e-mail"),
    );
  });

  it("uploads on preview without touching the invoice", async () => {
    ops.renderInvoicePdf.mockResolvedValue(new Uint8Array([1]));
    ops.renderIsdoc.mockReturnValue("<xml/>");
    const { ctx, request } = makeCtx();
    await handleInvoiceyInteraction(
      buttonClick(INVOICEY_ACTIONS.previewPdf),
      ctx,
    );
    expect(ops.uploadInvoiceArtifacts).toHaveBeenCalled();
    expect(ops.issueInvoiceById).not.toHaveBeenCalled();
    expect(ops.updateDraftInvoice).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
