import { isNull, type SQL } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces } from "./workspaces";

/**
 * Free invoice generator reservations (Plan 34, ADR 0048). One row per guest
 * issue — written *before* the invoice exists, because the reservation, not
 * the invoice, is what has to win the race for the monthly allowance.
 *
 * There is deliberately no separate `guest_invoices` table: the invoice
 * itself is issued through the ordinary `invoices` repository path into the
 * guest workspace this row points at (ADR 0048 §2). This table only tracks
 * the *allowance* — who used their one issue this month, and which workspace
 * / invoice it produced.
 */
export const guestIssues = pgTable(
  "guest_issues",
  {
    id: uuid("id").primaryKey(),
    /** Normalized lowercase guest address. */
    email: text("email").notNull(),
    /** `"YYYY-MM"` in Europe/Prague — see `guestAllowancePeriod`. */
    period: text("period").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * Set once issuance succeeds (`attachGuestIssueInvoice`). Null between
     * reservation and issue, and again if issuance failed and the reservation
     * was released. No FK to `invoices`: that table has no FK back to
     * `workspaces` either (see `deleteExpiredGuestWorkspaces`), so this row's
     * only durable link is `workspaceId`.
     */
    invoiceId: uuid("invoice_id"),
    /**
     * Soft signal only — counted for the nudge copy, never a block (ADR 0048
     * §4, §"IČO as a soft signal"). A public IČO is not proof of control over
     * the company, so it must never gate issuance.
     */
    issuerIco: text("issuer_ico"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * This unique index **is** the monthly allowance. It is enforced here,
     * in the database, rather than by a read-then-write check in application
     * code, because a read-then-write check has a race window that two
     * concurrent submissions from the same address can both win.
     */
    uniqueIndex("guest_issues_email_period_uidx").on(t.email, t.period),
    index("guest_issues_workspace_idx").on(t.workspaceId),
    index("guest_issues_ico_created_idx").on(t.issuerIco, t.createdAt),
    index("guest_issues_created_idx").on(t.createdAt),
  ],
);

/** Unclaimed guest data is hard-deleted past this age (ADR 0048 §8). */
export const GUEST_RETENTION_MONTHS = 12;

/**
 * The cutoff for the guest-retention sweep: workspaces unclaimed since before
 * this instant are past their 12-month window. Pure (no DB, no timezone
 * lookup — this is a fixed calendar-month offset, not a Prague day boundary
 * like `guestAllowancePeriod`), so the boundary arithmetic is unit tested
 * without a database in `guest-allowance.test.ts`.
 */
export function guestRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - GUEST_RETENTION_MONTHS);
  return cutoff;
}

/**
 * The predicate that turns `workspaces` back into "just the tenants": every
 * cross-tenant query — admin metrics, plan counts, cross-workspace listings —
 * must apply this (ADR 0048 §2), or a guest workspace silently counts as a
 * customer.
 */
export function notUnclaimedWorkspaces(): SQL {
  return isNull(workspaces.unclaimedSince);
}
