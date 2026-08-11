import { describe, expect, it } from "vitest";

import {
  renderInvoiceSentEmail,
  renderNewSignInEmail,
  renderOverdueReminderEmail,
  renderPaymentReceivedEmail,
  renderWorkspaceInviteEmail,
} from "./render";

const invoiceFixture = {
  coverText: "Dobrý den,\n\nv příloze zasílám fakturu.\n\nS pozdravem",
  number: "2026-0001",
  issueDate: "2026-08-01",
  dueDate: "2026-08-15",
  totalLabel: "12 100,00 Kč",
  clientName: "Klient s.r.o.",
  issuerName: "Dodavatel s.r.o.",
  invoiceUrl: "https://invoicey.ditrich.me/invoices/abc",
};

describe("email renders", () => {
  it("renders invoice_sent", async () => {
    const out = await renderInvoiceSentEmail(invoiceFixture);
    expect(out.subject).toContain("2026-0001");
    expect(out.html).toContain("Klient s.r.o.");
    expect(out.text.length).toBeGreaterThan(20);
  });

  it("renders workspace_invite", async () => {
    const out = await renderWorkspaceInviteEmail({
      workspaceName: "Invoicey",
      inviterName: "Filip",
      inviteUrl: "https://invoicey.ditrich.me/invite/xyz",
      role: "member",
      expiresAtLabel: "13. 8. 2026 20:47",
    });
    expect(out.subject).toContain("Invoicey");
    expect(out.subject).toContain("13. 8. 2026");
    expect(out.html).toContain("Přijmout pozvánku");
    expect(out.html).toContain("člen");
    expect(out.html).toContain("platí do");
    expect(out.text).toContain("invite/xyz");
  });

  it("renders overdue_reminder", async () => {
    const out = await renderOverdueReminderEmail(invoiceFixture);
    expect(out.subject).toContain("Připomínka");
    expect(out.html).toContain("po splatnosti");
  });

  it("renders payment_received", async () => {
    const out = await renderPaymentReceivedEmail(invoiceFixture);
    expect(out.subject).toContain("Platba");
    expect(out.html).toContain("přijetí platby");
  });

  it("renders new_sign_in", async () => {
    const out = await renderNewSignInEmail({
      userName: "Filip",
      ipAddress: "1.2.3.4",
      userAgent: "Chrome",
      signedInAt: "11. 8. 2026 13:00",
      trustUrl: "https://invoicey.ditrich.me/security/trust?token=abc",
      securitySettingsUrl: "https://invoicey.ditrich.me/settings/security",
    });
    expect(out.subject).toContain("přihlášení");
    expect(out.html).toContain("Důvěřovat tomuto zařízení");
    expect(out.text).toContain("settings/security");
  });
});
