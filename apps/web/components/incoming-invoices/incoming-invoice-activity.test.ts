import { describe, expect, it } from "vitest";
import {
  incomingActivitySteps,
  incomingNextAction,
  incomingPaymentAction,
} from "./incoming-invoice-activity";

describe("incoming invoice activity", () => {
  it("names explicit next actions for exception, review, approval, payment, and terminal work", () => {
    expect(
      incomingNextAction({
        status: "unsupported",
        paymentState: "unpaid",
        exceptions: [],
      }),
    ).toBe("resolve_exception");
    expect(
      incomingNextAction({
        status: "needs_validation",
        paymentState: "unpaid",
        exceptions: [],
      }),
    ).toBe("review");
    expect(
      incomingNextAction({
        status: "validated",
        paymentState: "unpaid",
        exceptions: [],
      }),
    ).toBe("waiting");
    expect(
      incomingNextAction({
        status: "pending_approval",
        paymentState: "unpaid",
        exceptions: [],
      }),
    ).toBe("approve");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "unpaid",
        exceptions: [],
      }),
    ).toBe("schedule_payment");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "unpaid",
        exceptions: [],
        activePaymentRunId: "run-1",
        activePaymentRunStatus: "ready",
      }),
    ).toBe("view_payment_run");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "paid",
        exceptions: [],
      }),
    ).toBe("none");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "paid",
        exceptions: ["historical"],
      }),
    ).toBe("none");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "unpaid",
        exceptions: ["historical"],
      }),
    ).toBe("schedule_payment");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "overpaid",
        exceptions: [],
      }),
    ).toBe("none");
    expect(
      incomingNextAction({
        status: "approved",
        paymentState: "unpaid",
        exceptions: [],
        docType: "credit_note",
      }),
    ).toBe("none");
  });
  it("derives progress only from persisted status and payment state", () => {
    expect(
      incomingActivitySteps({
        status: "approved",
        paymentState: "unpaid",
      }).find((item) => item.step === "approval")?.complete,
    ).toBe(true);
    expect(
      incomingActivitySteps({
        status: "rejected",
        paymentState: "unpaid",
      }).find((item) => item.step === "approval")?.complete,
    ).toBe(false);
    expect(
      incomingActivitySteps({
        status: "on_hold",
        paymentState: "unpaid",
      }).find((item) => item.step === "review")?.complete,
    ).toBe(false);
    expect(
      incomingActivitySteps({
        status: "approved",
        paymentState: "overpaid",
      }).find((item) => item.step === "payment")?.complete,
    ).toBe(true);
  });

  it("keeps an approved invoice in its active payment run instead of offering it again", () => {
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "unpaid",
        activePaymentRunId: null,
        activePaymentRunStatus: null,
      }),
    ).toBe("schedule_payment");
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "unpaid",
        activePaymentRunId: "run-1",
        activePaymentRunStatus: "ready",
      }),
    ).toBe("view_payment_run");
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "paid",
        activePaymentRunId: "run-1",
        activePaymentRunStatus: "submitted",
      }),
    ).toBe("none");
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "unpaid",
        paymentEligible: false,
        paymentBlocker: "unconfirmed_beneficiary",
      }),
    ).toBe("configure_payment");
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "overpaid",
        activePaymentRunId: "run-1",
        activePaymentRunStatus: "submitted",
      }),
    ).toBe("none");
    expect(
      incomingPaymentAction({
        status: "approved",
        paymentState: "unpaid",
        docType: "credit_note",
      }),
    ).toBe("none");
  });

  it("shows the active payment-run stage with its persisted status", () => {
    expect(
      incomingActivitySteps({
        status: "approved",
        paymentState: "unpaid",
        activePaymentRunId: "run-1",
        activePaymentRunStatus: "submitting",
      }).find((item) => item.step === "payment_run"),
    ).toEqual({
      step: "payment_run",
      complete: false,
      state: "submitting",
    });
  });
});
