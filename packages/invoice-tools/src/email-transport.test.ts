import { describe, expect, it } from "vitest";

import { emailFromFamily, resolveTransactionalFrom } from "./email-transport";

describe("email From resolution", () => {
  it("classifies template families", () => {
    expect(emailFromFamily("invoice_sent")).toBe("invoice");
    expect(emailFromFamily("overdue_reminder")).toBe("invoice");
    expect(emailFromFamily("payment_received")).toBe("invoice");
    expect(emailFromFamily("new_sign_in")).toBe("system");
    expect(emailFromFamily("workspace_invite")).toBe("system");
  });

  it("resolves invoice From with via display and invoices@", () => {
    const from = resolveTransactionalFrom({
      template: "invoice_sent",
      displayName: "ACME",
    });
    expect(from.family).toBe("invoice");
    expect(from.display).toBe("ACME via Invoicey");
    expect(from.address).toBe("invoices@invoicey.ditrich.me");
    expect(from.header).toBe(
      "ACME via Invoicey <invoices@invoicey.ditrich.me>",
    );
  });

  it("resolves system From without via append and noreply@", () => {
    const from = resolveTransactionalFrom({
      template: "new_sign_in",
      displayName: "Invoicey",
    });
    expect(from.family).toBe("system");
    expect(from.display).toBe("Invoicey");
    expect(from.address).toBe("noreply@invoicey.ditrich.me");
    expect(from.header).toBe("Invoicey <noreply@invoicey.ditrich.me>");
  });

  it("keeps explicit via display on system invites", () => {
    const from = resolveTransactionalFrom({
      template: "workspace_invite",
      displayName: "Filip via Invoicey",
      emailSystemFrom: "Invoicey <noreply@invoicey.ditrich.me>",
    });
    expect(from.display).toBe("Filip via Invoicey");
    expect(from.address).toBe("noreply@invoicey.ditrich.me");
  });

  it("honors EMAIL_FROM and EMAIL_SYSTEM_FROM overrides", () => {
    const invoice = resolveTransactionalFrom({
      template: "invoice_sent",
      displayName: "ACME via Invoicey",
      emailFrom: "Custom <billing@invoicey.ditrich.me>",
    });
    expect(invoice.address).toBe("billing@invoicey.ditrich.me");

    const system = resolveTransactionalFrom({
      template: "new_sign_in",
      displayName: "Invoicey",
      emailSystemFrom: "Alerts <security@invoicey.ditrich.me>",
    });
    expect(system.address).toBe("security@invoicey.ditrich.me");
  });
});
