import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  denied: true,
  context: vi.fn(async () => ({
    workspaceId: "qa-workspace",
    userId: "qa-user",
  })),
  confirm: vi.fn(async () => ({
    ok: true,
    invoiceId: "qa-invoice",
    becamePaid: false,
  })),
  reject: vi.fn(async () => true),
  create: vi.fn(async () => ({ ok: true, becamePaid: false })),
  reverse: vi.fn(async () => ({ ok: true, invoiceId: "qa-invoice" })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requireWritableWorkspace: state.context,
}));
vi.mock("@/lib/authz/can", () => ({
  assertCan: async (permission: string) => {
    if (permission !== "payments:manage")
      throw new Error("Wrong payment permission");
    if (state.denied) throw new Error("Missing permission: payments:manage");
  },
}));
vi.mock("@invoicey/db", () => ({
  confirmPaymentMatchProposal: state.confirm,
  rejectPaymentMatchProposal: state.reject,
  createManualPaymentAllocation: state.create,
  reversePaymentAllocation: state.reverse,
}));
vi.mock("@invoicey/db/client", () => ({ db: {} }));
vi.mock("@invoicey/invoice-tools/email", () => ({
  sendPaymentReceivedEmailIfEnabled: vi.fn(),
}));
vi.mock("@/lib/payments/connections", () => ({
  listActiveBankConnections: vi.fn(),
}));
vi.mock("@/lib/payments/fio-service", () => ({}));
vi.mock("@/lib/payments/moneta-service", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import {
  addManualPayment,
  confirmPaymentProposal,
  rejectPaymentProposal,
  reversePayment,
} from "@/actions/payments";

const cases = [
  {
    name: "recording a manual payment",
    action: addManualPayment,
    mutation: state.create,
    toast: "payment_added",
  },
  {
    name: "confirming a bank match",
    action: confirmPaymentProposal,
    mutation: state.confirm,
    toast: "payment_confirmed",
  },
  {
    name: "rejecting a bank match",
    action: rejectPaymentProposal,
    mutation: state.reject,
    toast: "payment_rejected",
  },
  {
    name: "reversing an allocation",
    action: reversePayment,
    mutation: state.reverse,
    toast: "payment_reversed",
  },
];
function paymentForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    invoiceId: "qa-invoice",
    proposalId: "qa-proposal",
    allocationId: "qa-allocation",
    amount: "500",
    effectiveDate: "2026-10-21",
  }))
    form.set(key, value);
  return form;
}
beforeEach(() => {
  state.denied = true;
  vi.clearAllMocks();
});
for (const scenario of cases) {
  // Regression: membership/freeze checks alone allowed callers without payments:manage.
  it(`denies ${scenario.name} before workspace access or ledger mutation`, async () => {
    await expect(scenario.action(paymentForm())).rejects.toThrow(
      "Missing permission: payments:manage",
    );
    expect(state.context).not.toHaveBeenCalled();
    for (const mutation of [
      state.confirm,
      state.reject,
      state.create,
      state.reverse,
    ])
      expect(mutation).not.toHaveBeenCalled();
  });
  it(`permits ${scenario.name} for a payment manager`, async () => {
    state.denied = false;
    await expect(scenario.action(paymentForm())).rejects.toThrow(
      `redirect:/payments?toast=${scenario.toast}`,
    );
    expect(scenario.mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "qa-workspace",
        actorUserId: "qa-user",
      }),
    );
  });
}
