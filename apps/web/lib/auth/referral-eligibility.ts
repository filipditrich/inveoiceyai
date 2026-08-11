/** oauth can take a while; still treat as "new signup" within this window */
export const REFERRAL_ATTRIBUTION_WINDOW_MS = 60 * 60 * 1000;

/** returning users who later open a referral link must not rewrite history */
export function isEligibleForReferralAttribution(
  createdAt: Date | string | number,
  now: Date = new Date(),
  windowMs: number = REFERRAL_ATTRIBUTION_WINDOW_MS,
): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() - created.getTime() <= windowMs;
}
