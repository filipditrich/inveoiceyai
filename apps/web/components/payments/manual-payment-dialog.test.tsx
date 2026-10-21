import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
const cs = JSON.parse(
  readFileSync(new URL("../../locales/cs.json", import.meta.url), "utf8"),
);
const en = JSON.parse(
  readFileSync(new URL("../../locales/en.json", import.meta.url), "utf8"),
);
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const formStatus = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({
    pending: formStatus.pending,
    data: null,
    method: null,
    action: null,
  }),
}));
vi.mock("@/actions/payments", () => ({ addManualPayment: vi.fn() }));
// Render the dialog body without a browser portal; keep the real fields and buttons.
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Container,
    DialogContent: Container,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogTitle: Container,
  };
});

import { ManualPaymentDialog } from "./manual-payment-dialog";

function renderSubmit(locale: "cs" | "en") {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "cs" ? cs : en}
      timeZone="UTC"
    >
      <ManualPaymentDialog
        invoices={[
          {
            id: "b5557c01-104a-42ca-81ae-0b0e183d6abf",
            number: "20260001",
            clientName: "Test client",
            currency: "CZK",
            outstanding: "1250.00",
          },
        ]}
        locale={locale}
        defaultDate="2026-10-21"
      />
    </NextIntlClientProvider>,
  );
  return (
    html.match(/<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? ""
  );
}

describe("manual payment submit feedback", () => {
  beforeEach(() => {
    formStatus.pending = false;
  });

  for (const [locale, label] of [
    ["en", "Recording payment…"],
    ["cs", "Zapisuji platbu…"],
  ] as const) {
    it(`disables repeat taps and announces the pending payment in ${locale}`, () => {
      formStatus.pending = true;
      const submit = renderSubmit(locale);
      expect(submit).toContain('disabled=""');
      expect(submit).toContain('aria-busy="true"');
      expect(submit).toContain(label);
    });
  }

  it("allows payment entry again when no action is pending", () => {
    const submit = renderSubmit("en");
    expect(submit).toContain("Add payment");
    expect(submit).not.toContain('disabled=""');
    expect(submit).not.toContain('aria-busy="true"');
  });
});
