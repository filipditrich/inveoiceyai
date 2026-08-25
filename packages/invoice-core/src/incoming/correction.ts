/**
 * Identity resolution for an arriving invoice.
 *
 * Three outcomes for the same (workspace, issuer, supplier, number) identity:
 *
 * - a **live** invoice already holds it → duplicate, blocked at gate 1;
 * - a **rejected** invoice holds it → this is the supplier's correction, so the
 *   two are linked into a chain rather than treated as a duplicate;
 * - nobody holds it → an ordinary new invoice.
 *
 * The partial unique index on `incoming_invoices` already excludes rejected and
 * cancelled rows, so the correction case does not collide on insert.
 */
export type IdentityPredecessor = {
  id: string;
  correctionRound: number;
};

export type IdentityLink = {
  duplicateOfId: string | null;
  supersedesId: string | null;
  correctionRound: number;
};

export function resolveIdentityLink(input: {
  /** A live (non-rejected, non-cancelled) invoice under this identity. */
  liveDuplicate?: { id: string } | null;
  /** The most recent rejected invoice under this identity that nothing else
   * already supersedes. */
  rejectedPredecessor?: IdentityPredecessor | null;
}): IdentityLink {
  if (input.liveDuplicate) {
    return {
      duplicateOfId: input.liveDuplicate.id,
      supersedesId: null,
      correctionRound: 0,
    };
  }
  if (input.rejectedPredecessor) {
    return {
      duplicateOfId: null,
      supersedesId: input.rejectedPredecessor.id,
      correctionRound: input.rejectedPredecessor.correctionRound + 1,
    };
  }
  return { duplicateOfId: null, supersedesId: null, correctionRound: 0 };
}
