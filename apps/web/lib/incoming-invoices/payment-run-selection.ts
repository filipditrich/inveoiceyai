export function selectEligiblePaymentRunIds(
  rows: readonly { id: string; blockers: readonly string[] }[],
): string[] {
  return rows.filter((row) => row.blockers.length === 0).map((row) => row.id);
}
