export type IncomingNextAction =
  | "review"
  | "resolve_exception"
  | "waiting"
  | "approve"
  | "schedule_payment"
  | "configure_payment"
  | "view_payment_run"
  | "none";

export type IncomingPaymentAction =
  "schedule_payment" | "configure_payment" | "view_payment_run" | "none";

type IncomingPaymentActionInput = {
  status: string;
  paymentState: string;
  docType?: string;
  activePaymentRunId?: string | null;
  activePaymentRunStatus?: string | null;
  paymentEligible?: boolean;
  paymentBlocker?: string | null;
};

/**
 * Keeps every incoming-invoice surface from offering a payment run twice.
 * A persisted active run claim wins over the otherwise payable approved state.
 */
export function incomingPaymentAction(
  input: IncomingPaymentActionInput,
): IncomingPaymentAction {
  if (
    input.status !== "approved" ||
    input.paymentState === "paid" ||
    input.paymentState === "overpaid" ||
    input.docType === "credit_note"
  ) {
    return "none";
  }

  if (input.activePaymentRunId) return "view_payment_run";
  if (input.paymentEligible === false) return "configure_payment";
  return "schedule_payment";
}

export function incomingNextAction(input: {
  status: string;
  paymentState: string;
  exceptions: readonly string[];
  docType?: string;
  activePaymentRunId?: string | null;
  activePaymentRunStatus?: string | null;
  paymentEligible?: boolean;
  paymentBlocker?: string | null;
}): IncomingNextAction {
  if (
    input.status === "rejected" ||
    input.status === "cancelled" ||
    input.paymentState === "paid" ||
    input.paymentState === "overpaid" ||
    input.docType === "credit_note"
  )
    return "none";
  if (["approved", "pending_approval", "validated"].includes(input.status)) {
    if (input.status === "approved") return incomingPaymentAction(input);
    if (input.status === "pending_approval") return "approve";
    return "waiting";
  }
  if (["needs_validation", "unsupported", "on_hold"].includes(input.status)) {
    return input.exceptions.length > 0 || input.status !== "needs_validation"
      ? "resolve_exception"
      : "review";
  }
  return "review";
}

export function incomingActivitySteps(input: {
  status: string;
  paymentState: string;
  activePaymentRunId?: string | null;
  activePaymentRunStatus?: string | null;
}) {
  const steps = ["capture", "extraction", "review", "approval"];
  if (input.activePaymentRunId) steps.push("payment_run");
  steps.push("payment");

  return steps.map((step) => ({
    step,
    complete:
      step === "capture" ||
      (step === "extraction" && input.status !== "unsupported") ||
      (step === "review" &&
        !["needs_validation", "unsupported", "on_hold"].includes(
          input.status,
        )) ||
      (step === "approval" && input.status === "approved") ||
      (step === "payment_run" &&
        ["submitted", "closed"].includes(input.activePaymentRunStatus ?? "")) ||
      (step === "payment" &&
        (input.paymentState === "paid" || input.paymentState === "overpaid")),
    ...(step === "payment_run" && input.activePaymentRunStatus
      ? { state: input.activePaymentRunStatus }
      : {}),
  }));
}
