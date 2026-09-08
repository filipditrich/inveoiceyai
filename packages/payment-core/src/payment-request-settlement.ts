import { decimalToMinor, minorToDecimal } from "./money";

export type PaymentRequestStatus = "open" | "settled" | "cancelled";

export type PaymentRequestCandidate = {
  id: string;
  status: PaymentRequestStatus;
  amount: string;
  allocated: string;
  variableSymbol: string;
};

export type PaymentRequestDecision =
  | { action: "settle"; requestId: string; amount: string; overAmount?: string }
  | { action: "partial"; requestId: string; amount: string }
  | { action: "duplicate"; requestId: string }
  | { action: "propose"; requestIds: string[]; amount: string }
  | { action: "unmatched" };

function remainingMinor(request: PaymentRequestCandidate): bigint {
  const asked = decimalToMinor(request.amount);
  const allocated = decimalToMinor(request.allocated);
  return asked > allocated ? asked - allocated : BigInt(0);
}

/**
 * How a credit should treat payment requests.
 *
 * Distinct from `isExactAutoMatchProposal`: invoice matching infers intent and
 * stays behind the workspace opt-in. A request is something Invoicey asked
 * for, so exact symbol + exact remaining amount settles without that flag.
 */
export function decidePaymentRequestMatch(input: {
  creditAmount: string;
  creditSymbol: string | null;
  requests: PaymentRequestCandidate[];
}): PaymentRequestDecision {
  const credit = decimalToMinor(input.creditAmount);
  if (credit <= BigInt(0)) return { action: "unmatched" };

  if (input.creditSymbol) {
    return decideExactSymbol(input.creditSymbol, credit, input.requests);
  }
  return decideNoSymbol(credit, input.requests);
}

function decideExactSymbol(
  symbol: string,
  credit: bigint,
  requests: PaymentRequestCandidate[],
): PaymentRequestDecision {
  const request = requests.find((row) => row.variableSymbol === symbol);
  if (!request || request.status === "cancelled") {
    return { action: "unmatched" };
  }
  if (request.status === "settled") {
    return { action: "duplicate", requestId: request.id };
  }

  const remaining = remainingMinor(request);
  if (remaining <= BigInt(0)) {
    return { action: "duplicate", requestId: request.id };
  }
  if (credit === remaining) {
    return {
      action: "settle",
      requestId: request.id,
      amount: minorToDecimal(credit),
    };
  }
  if (credit < remaining) {
    return {
      action: "partial",
      requestId: request.id,
      amount: minorToDecimal(credit),
    };
  }
  return {
    action: "settle",
    requestId: request.id,
    amount: minorToDecimal(remaining),
    overAmount: minorToDecimal(credit - remaining),
  };
}

function decideNoSymbol(
  credit: bigint,
  requests: PaymentRequestCandidate[],
): PaymentRequestDecision {
  const matches = requests.filter(
    (request) =>
      request.status === "open" && remainingMinor(request) === credit,
  );
  if (matches.length === 0) return { action: "unmatched" };
  return {
    action: "propose",
    requestIds: matches.map((request) => request.id),
    amount: minorToDecimal(credit),
  };
}
