import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";

import { member } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";
import { guestIssues } from "./guest-issuance";
import { getDefaultPlan } from "./plans-repo";
import { clients, emailMessages, invoices, issuerBusinesses } from "./schema";
import { withDbTransaction } from "./transaction";
import { workspaces } from "./workspaces";

/** Postgres unique_violation, matches `apps/web/lib/auth/workspace-bootstrap.ts`. */
const UNIQUE_VIOLATION = "23505";

/**
 * `constraint` narrows to a specific unique index (Neon surfaces Postgres's
 * `n` field as `.constraint`). Undefined means "any unique violation",
 * used by the workspace-slug retry loop, which does not care which unique
 * index it tripped — only that it should try a new slug.
 */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  // SAFETY: narrowed to a non-null object above; both fields are read
  // opportunistically (`unknown`) and compared, never trusted as present —
  // an error object without them just fails the comparison below.
  const pg = error as { code?: unknown; constraint?: unknown };
  if (pg.code !== UNIQUE_VIOLATION) {
    return false;
  }
  return constraint === undefined || pg.constraint === constraint;
}

function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Calendar-month allowance bucket, `"YYYY-MM"` in Europe/Prague. Pure — no DB
 * access — so the monthly boundary (including DST-shifted midnights) is unit
 * tested without a database in `guest-allowance.test.ts`.
 *
 * `en-CA` is a locale trick, not a Canada reference: it is the shortest
 * built-in `Intl.DateTimeFormat` locale that renders numeric year-month as
 * `YYYY-MM`, the same trick `pragueTodayIso` in `@invoicey/invoice-core` uses
 * for the day-level equivalent.
 */
export function guestAllowancePeriod(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
  }).format(now);
}

export type ReserveGuestIssueResult =
  | { ok: true; reservationId: string; workspaceId: string }
  | { ok: false; reason: "allowance_exhausted" };

/**
 * Reserve this month's single guest issue for an address and create the
 * unclaimed workspace it will be issued into.
 *
 * The reservation is written before the invoice exists so a race cannot mint
 * two invoices for one address: two concurrent submissions both pass an
 * application-level allowance check, but only one of them can win the
 * `(email, period)` unique index, and that index — not this function's
 * control flow — is the actual arbiter (ADR 0048 §4).
 *
 * No member row, AI token balance, or signup grant is created: those are
 * ordinary-workspace bootstrapping and belong to `claimGuestWorkspace`, which
 * runs the same instant the workspace stops being a guest.
 */
export async function reserveGuestIssue(
  database: InvoiceyDb,
  input: {
    email: string;
    issuerIco?: string | null;
    marketingOptIn: boolean;
    workspaceName: string;
    now?: Date;
  },
): Promise<ReserveGuestIssueResult> {
  const email = input.email.trim().toLowerCase();
  const now = input.now ?? new Date();
  const period = guestAllowancePeriod(now);
  // Read outside the retry loop: it does not depend on the slug, and a fresh
  // transaction per attempt would otherwise re-run it (mirrors
  // `createPersonalWorkspace` in `apps/web/lib/auth/workspace-bootstrap.ts`).
  const plan = await getDefaultPlan(database);

  let slug = `guest-${randomSlugSuffix()}`;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withDbTransaction(async (tx) => {
        const workspaceId = crypto.randomUUID();
        await tx.insert(workspaces).values({
          id: workspaceId,
          name: input.workspaceName,
          slug,
          planId: plan.id,
          guestEmail: email,
          unclaimedSince: now,
        });

        const reservationId = crypto.randomUUID();
        await tx.insert(guestIssues).values({
          id: reservationId,
          email,
          period,
          workspaceId,
          issuerIco: input.issuerIco ?? null,
          marketingOptIn: input.marketingOptIn,
        });

        return { ok: true as const, reservationId, workspaceId };
      });
    } catch (error) {
      // The allowance index is the actual business rule this function
      // enforces — a hit here is an expected outcome, not a fault.
      if (isUniqueViolation(error, "guest_issues_email_period_uidx")) {
        return { ok: false, reason: "allowance_exhausted" };
      }
      // Any other unique violation this transaction can hit is the slug.
      // A failed statement aborts the Postgres transaction, so retrying
      // inside it is not an option — each attempt gets a fresh one.
      if (attempt >= 4 || !isUniqueViolation(error)) throw error;
      slug = `guest-${randomSlugSuffix()}`;
    }
  }
}

/** Link the issued invoice to its reservation once issuance succeeded. */
export async function attachGuestIssueInvoice(
  database: InvoiceyDb,
  input: { reservationId: string; invoiceId: string },
): Promise<void> {
  await database
    .update(guestIssues)
    .set({ invoiceId: input.invoiceId })
    .where(eq(guestIssues.id, input.reservationId));
}

/**
 * Undo a reservation whose issuance failed, so the address keeps its month.
 *
 * Deletes the workspace `reserveGuestIssue` created for this reservation
 * rather than only the `guest_issues` row: nothing else can have been
 * attached to a guest workspace before an invoice exists (issuer, client, and
 * look snapshots are all written as part of issuing the one invoice a guest
 * workspace ever holds), so a failed issuance leaves nothing worth keeping.
 * Deleting the workspace cascades to `guest_issues` (`onDelete: cascade`),
 * which is what actually frees the `(email, period)` slot.
 *
 * The `reservationId` match is a safety guard against a caller passing a
 * `workspaceId` that does not belong to the reservation it thinks it is
 * releasing; on a mismatch this is a no-op rather than a delete.
 */
export async function releaseGuestIssue(
  database: InvoiceyDb,
  input: { reservationId: string; workspaceId: string },
): Promise<void> {
  await withDbTransaction(async (tx) => {
    const [reservation] = await tx
      .select({ id: guestIssues.id })
      .from(guestIssues)
      .where(
        and(
          eq(guestIssues.id, input.reservationId),
          eq(guestIssues.workspaceId, input.workspaceId),
        ),
      )
      .limit(1);
    if (!reservation) return;

    await tx.delete(workspaces).where(eq(workspaces.id, input.workspaceId));
  });
}

/**
 * Soft signal for the nudge copy — never a block (ADR 0048 §4). IČO is public
 * ARES data, so a hard block on it would let anyone burn a real company's
 * allowance by typing their public IČO into the form.
 */
export async function countGuestIssuesByIco(
  database: InvoiceyDb,
  input: { ico: string; since: Date },
): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(guestIssues)
    .where(
      and(
        eq(guestIssues.issuerIco, input.ico),
        gte(guestIssues.createdAt, input.since),
      ),
    );
  return row?.count ?? 0;
}

export interface UnclaimedGuestWorkspace {
  id: string;
  name: string;
  guestEmail: string;
  unclaimedSince: Date;
}

/**
 * Workspaces this address can auto-claim by OAuth address match. Ordered
 * newest-first: a visitor who issued more than once (different months) sees
 * their most recent invoice claimed first, and claiming does not merge
 * workspaces (ADR 0048), so callers offer one at a time.
 */
export async function findUnclaimedGuestWorkspaces(
  database: InvoiceyDb,
  input: { email: string },
): Promise<UnclaimedGuestWorkspace[]> {
  const rows = await database
    .select({
      id: workspaces.id,
      name: workspaces.name,
      guestEmail: workspaces.guestEmail,
      unclaimedSince: workspaces.unclaimedSince,
    })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.guestEmail, input.email.trim().toLowerCase()),
        isNotNull(workspaces.unclaimedSince),
      ),
    )
    .orderBy(desc(workspaces.unclaimedSince));

  // SAFETY: both columns are non-null by construction for any row matched by
  // `isNotNull(unclaimedSince)` — `guestEmail` is set in the same
  // `reserveGuestIssue` insert that sets `unclaimedSince`, and never cleared
  // independently of it (only `claimGuestWorkspace` clears either, and it
  // clears both together).
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    guestEmail: row.guestEmail as string,
    unclaimedSince: row.unclaimedSince as Date,
  }));
}

export interface GuestIssueByWorkspace {
  id: string;
  email: string;
  invoiceId: string | null;
  marketingOptIn: boolean;
}

/** The reservation behind a guest workspace's one invoice, if any. */
export async function getGuestIssueByWorkspace(
  database: InvoiceyDb,
  input: { workspaceId: string },
): Promise<GuestIssueByWorkspace | null> {
  const [row] = await database
    .select({
      id: guestIssues.id,
      email: guestIssues.email,
      invoiceId: guestIssues.invoiceId,
      marketingOptIn: guestIssues.marketingOptIn,
    })
    .from(guestIssues)
    .where(eq(guestIssues.workspaceId, input.workspaceId))
    .orderBy(desc(guestIssues.createdAt))
    .limit(1);
  return row ?? null;
}

export type ClaimGuestWorkspaceResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_claimed" };

/**
 * Ownership change, not a data migration (ADR 0048): insert the owner member
 * row, clear `unclaimed_since`, stamp claim provenance, rename the workspace.
 *
 * The guard and the update run as one conditional `UPDATE ... WHERE
 * unclaimed_since IS NOT NULL`, not a read-then-write: two concurrent claims
 * (an OAuth address match racing a mailed claim-token click) can both read
 * "still unclaimed", but only one `UPDATE` can flip the row, and
 * `.returning()` tells the loser it lost without a second round trip.
 */
export async function claimGuestWorkspace(
  database: InvoiceyDb,
  input: { workspaceId: string; userId: string; name: string; slug: string },
): Promise<ClaimGuestWorkspaceResult> {
  return withDbTransaction(async (tx) => {
    const now = new Date();
    const [claimed] = await tx
      .update(workspaces)
      .set({
        name: input.name,
        slug: input.slug,
        unclaimedSince: null,
        claimedAt: now,
        claimedBy: input.userId,
      })
      .where(
        and(
          eq(workspaces.id, input.workspaceId),
          isNotNull(workspaces.unclaimedSince),
        ),
      )
      .returning({ id: workspaces.id });

    if (!claimed) {
      const [exists] = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, input.workspaceId))
        .limit(1);
      return { ok: false, reason: exists ? "already_claimed" : "not_found" };
    }

    await tx.insert(member).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      organizationId: input.workspaceId,
      role: "owner",
      createdAt: now,
    });

    return { ok: true };
  });
}

export interface DeleteExpiredGuestWorkspacesResult {
  deletedWorkspaces: number;
}

/**
 * Hard-delete unclaimed guest data past the retention window (ADR 0048 §8).
 *
 * `invoices`, `clients`, and `issuer_businesses` are deleted explicitly and
 * in that order: none of the three declares a foreign key back to
 * `workspaces` in `schema.ts` (unlike most workspace-scoped tables — compare
 * `bankConnections.workspaceId`, which does), so deleting the `workspaces`
 * row would silently leave their rows behind pointing at a dead workspace id.
 * `invoices` first because `invoice_items` and `invoice_payment_allocations`
 * cascade from `invoices.id`, so deleting the parent clears both for free.
 * `guest_issues` is the one workspace-scoped table here that *does* declare
 * `onDelete: cascade` on `workspaceId` (see `guest-issuance.ts`), so it is
 * left for the final `workspaces` delete to clear.
 */
export async function deleteExpiredGuestWorkspaces(
  database: InvoiceyDb,
  input: { cutoff: Date },
): Promise<DeleteExpiredGuestWorkspacesResult> {
  return withDbTransaction(async (tx) => {
    const expired = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          isNotNull(workspaces.unclaimedSince),
          lt(workspaces.unclaimedSince, input.cutoff),
        ),
      );
    if (expired.length === 0) {
      return { deletedWorkspaces: 0 };
    }
    const ids = expired.map((row) => row.id);

    for (const workspaceId of ids) {
      // `email_messages` also carries a bare `workspace_id` with no FK, and a
      // guest workspace always has at least the invoice mail in it.
      await tx
        .delete(emailMessages)
        .where(eq(emailMessages.workspaceId, workspaceId));
      await tx.delete(invoices).where(eq(invoices.workspaceId, workspaceId));
      await tx.delete(clients).where(eq(clients.workspaceId, workspaceId));
      await tx
        .delete(issuerBusinesses)
        .where(eq(issuerBusinesses.workspaceId, workspaceId));
      await tx.delete(workspaces).where(eq(workspaces.id, workspaceId));
    }

    return { deletedWorkspaces: ids.length };
  });
}
