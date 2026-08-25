const ACCOUNTING_STATES = [
  "not_applicable",
  "pending",
  "queued",
  "exported",
  "failed",
  "settled",
] as const;

export type IncomingAccountingStateMessageKey =
  `accountingStatus.${(typeof ACCOUNTING_STATES)[number]}`;

export function incomingAccountingStateMessageKey(
  state: string,
): IncomingAccountingStateMessageKey {
  return (
    ACCOUNTING_STATES.includes(state as (typeof ACCOUNTING_STATES)[number])
      ? `accountingStatus.${state}`
      : "accountingStatus.not_applicable"
  ) as IncomingAccountingStateMessageKey;
}
