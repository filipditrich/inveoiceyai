import { createTranslator, NextIntlClientProvider } from "next-intl";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentsHistoryTable } from "./payments-ledger-tables";
import { PaymentsSuggestedTable } from "./payments-suggested-table";

const state = vi.hoisted((): { pending: boolean; locale: "cs" | "en" } => ({
  pending: false,
  locale: "en",
}));
const catalogs = Object.fromEntries(
  ["cs", "en"].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(
        new URL(`../../locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  useFormStatus: () => ({
    pending: state.pending,
    data: null,
    method: null,
    action: null,
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: catalogs[state.locale],
      namespace,
    }),
}));
vi.mock("@/actions/payments", () => ({
  confirmPaymentProposal: vi.fn(),
  rejectPaymentProposal: vi.fn(),
  reversePayment: vi.fn(),
}));
vi.mock("./table-pager", () => ({ TablePager: () => null }));

async function renderControls(locale: "cs" | "en") {
  state.locale = locale;
  const suggested = await PaymentsSuggestedTable({
    proposals: [
      {
        id: "proposal-1",
        amount: "500.00",
        score: 100,
        confidence: "high",
        reasons: ["exact_variable_symbol", "exact_outstanding_amount"],
        blockers: [],
        transactionAmount: "500.00",
        bookedDate: "2026-10-21",
        variableSymbol: "20260001",
        counterpartyName: "Test client",
        invoiceId: "invoice-1",
        invoiceNumber: "20260001",
        clientName: "Test client",
        currency: "CZK",
        paymentRequestId: null,
        paymentRequestMessage: null,
      },
    ],
    locale,
    reasonLabels: {},
    blockerLabels: {},
    page: 1,
    pageCount: 1,
    from: 1,
    to: 1,
    count: 1,
    query: {},
  });
  const history = await PaymentsHistoryTable({
    allocations: [
      {
        id: "allocation-1",
        invoiceId: "invoice-1",
        invoiceNumber: "20260001",
        clientName: "Test client",
        paymentRequestId: null,
        paymentRequestMessage: null,
        amount: "500.00",
        currency: "CZK",
        effectiveDate: "2026-10-21",
        sourceLabel: "Manual",
        reversedAt: null,
      },
    ],
    locale,
    pager: {
      page: 1,
      pageCount: 1,
      from: 1,
      to: 1,
      count: 1,
      query: {},
      pageKey: "history",
    },
  });
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={catalogs[locale]}
      timeZone="UTC"
    >
      {suggested}
      {history}
    </NextIntlClientProvider>,
  );
  return Array.from(
    html.matchAll(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/g),
    (match) => match[0],
  );
}

describe("payment review pending controls", () => {
  beforeEach(() => {
    state.pending = false;
  });
  for (const locale of ["en", "cs"] as const) {
    for (const [index, action, label] of [
      [0, "confirmation", locale === "en" ? "Confirming…" : "Potvrzuji…"],
      [1, "rejection", locale === "en" ? "Rejecting…" : "Odmítám…"],
      [2, "reversal", locale === "en" ? "Reversing…" : "Stornuji…"],
    ] as const) {
      it(`disables ${action} and renders its pending label in ${locale}`, async () => {
        state.pending = true;
        const controls = await renderControls(locale);
        expect(controls[index]).toContain('disabled=""');
        expect(controls[index]).toContain('aria-busy="true"');
        expect(controls[index]).toContain(label);
      });
    }
    it(`leaves idle review controls available in ${locale}`, async () => {
      const controls = await renderControls(locale);
      expect(controls).toHaveLength(3);
      for (const control of controls) {
        expect(control).not.toContain('disabled=""');
        expect(control).not.toContain('aria-busy="true"');
      }
    });
  }
});
