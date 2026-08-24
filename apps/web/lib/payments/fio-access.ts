export type FioAccessState = "read_only" | "submit_enabled" | "submit_expired";

type FioAccessInput = {
  accessMode: string;
  paymentEnabledAt: Date | null;
  paymentTokenExpiresAt: Date | null;
};

export function fioAccessState(
  input: FioAccessInput,
  now = new Date(),
): FioAccessState {
  if (input.accessMode !== "read_write" || !input.paymentEnabledAt) {
    return "read_only";
  }
  if (
    input.paymentTokenExpiresAt &&
    input.paymentTokenExpiresAt.getTime() <= now.getTime()
  ) {
    return "submit_expired";
  }
  return "submit_enabled";
}
