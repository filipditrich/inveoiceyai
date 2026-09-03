import type { SecurityAuditEventType } from "@invoicey/db";

/** Cross-tenant lists stay bounded; the UI must say so when we hit the cap. */
export const ADMIN_LIST_CAP = 2000;

/**
 * Every `platform_*` write the console records. Keep this in lockstep with
 * `recordSecurityAuditEvent` calls under `lib/admin/` — the audit page is
 * otherwise a lie.
 */
export const PLATFORM_AUDIT_TYPES = [
  "platform_admin_grant",
  "platform_admin_revoke",
  "platform_tokens_grant",
  "platform_workspace_rename",
  "platform_workspace_delete",
  "platform_member_remove",
  "platform_invite_cancel",
  "platform_plan_assign",
  "platform_plan_update",
] as const satisfies readonly SecurityAuditEventType[];

export type PlatformMonthPoint = {
  month: string;
  issued: number;
  paid: number;
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Twelve UTC months ending at `now`'s month, all zeros. */
export function emptyMonthlySeries(now = new Date()): PlatformMonthPoint[] {
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );
  const points: PlatformMonthPoint[] = [];
  for (let i = 0; i < 12; i++) {
    points.push({ month: monthKey(cursor), issued: 0, paid: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

/** Instant `days` UTC days before `now`. Not snapped to a month. */
export function utcDaysAgo(days: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/** First UTC day of the month `months` before `now`'s month. */
export function utcFirstOfMonthMonthsAgo(
  months: number,
  now = new Date(),
): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1),
  );
}
