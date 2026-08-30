/**
 * Stamp and signature follow the issuer asset. The per-invoice flags are
 * opt-out only — there is no builder control, so a missing flag used to hide
 * artwork the issuer had already uploaded.
 */
export function invoiceShowsIssuerAsset(flag: boolean | undefined): boolean {
  return flag !== false;
}
