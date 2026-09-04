import "server-only";
import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import {
  aiTokenBalances,
  aiUsageEvents,
  issuerBusinesses,
  invoices,
  member,
  notUnclaimedWorkspaces,
  plans,
  session,
  user,
  workspaces,
  type PlatformRole,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import { ADMIN_LIST_CAP, coerceDate, utcDaysAgo } from "./constants";
import { snapshotString } from "./snapshot";

export { ADMIN_LIST_CAP };

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  platformRole: PlatformRole;
  defaultWorkspaceId: string | null;
  referralCode: string | null;
  referredByEmail: string | null;
  createdAt: Date;
  membershipCount: number;
  lastSeenAt: Date | null;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  invoiceCount: number;
  issuerCount: number;
  planName: string;
  tokensRemaining: number;
  aiBurn30d: number;
  frozenAt: Date | null;
};

export type AdminInvoiceRow = {
  id: string;
  number: string | null;
  clientName: string;
  workspaceId: string;
  workspaceName: string;
  issuerId: string;
  issuerName: string;
  total: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  displayStatus: InvoiceDisplayStatus;
  updatedAt: Date;
};

export type AdminIssuerRow = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  ico: string | null;
  dic: string | null;
  source: string;
  updatedAt: Date;
};

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      platformRole: user.platformRole,
      defaultWorkspaceId: user.defaultWorkspaceId,
      referralCode: user.referralCode,
      referredByUserId: user.referredByUserId,
      createdAt: user.createdAt,
      membershipCount: sql<number>`cast(count(${member.id}) as int)`,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(ADMIN_LIST_CAP);

  const referrerIds = [
    ...new Set(
      rows
        .map((r) => r.referredByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const referrerEmails = new Map<string, string>();
  if (referrerIds.length > 0) {
    const referrers = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(inArray(user.id, referrerIds));
    for (const r of referrers) {
      referrerEmails.set(r.id, r.email);
    }
  }

  const userIds = rows.map((r) => r.id);
  const lastSeenRows =
    userIds.length === 0
      ? []
      : await db
          .select({
            userId: session.userId,
            lastSeenAt: sql<Date>`max(${session.updatedAt})`,
          })
          .from(session)
          .where(inArray(session.userId, userIds))
          .groupBy(session.userId);

  const lastSeenByUser = new Map(
    lastSeenRows.map((row) => [row.userId, row.lastSeenAt]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    emailVerified: r.emailVerified,
    platformRole: r.platformRole === "admin" ? "admin" : "none",
    defaultWorkspaceId: r.defaultWorkspaceId,
    referralCode: r.referralCode,
    referredByEmail: r.referredByUserId
      ? (referrerEmails.get(r.referredByUserId) ?? r.referredByUserId)
      : null,
    createdAt: r.createdAt,
    membershipCount: Number(r.membershipCount ?? 0),
    lastSeenAt: coerceDate(lastSeenByUser.get(r.id)),
  }));
}

export async function adminListWorkspaces(): Promise<AdminWorkspaceRow[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      planName: plans.name,
      frozenAt: workspaces.frozenAt,
    })
    .from(workspaces)
    .innerJoin(plans, eq(workspaces.planId, plans.id))
    .where(notUnclaimedWorkspaces())
    .orderBy(asc(workspaces.name))
    .limit(ADMIN_LIST_CAP);

  if (rows.length === 0) return [];

  const workspaceIds = rows.map((row) => row.id);
  const window30d = utcDaysAgo(30);
  const [memberCounts, invoiceCounts, issuerCounts, tokenRows, burnRows] =
    await Promise.all([
      db
        .select({
          workspaceId: member.organizationId,
          value: count(),
        })
        .from(member)
        .where(inArray(member.organizationId, workspaceIds))
        .groupBy(member.organizationId),
      db
        .select({
          workspaceId: invoices.workspaceId,
          value: count(),
        })
        .from(invoices)
        .where(inArray(invoices.workspaceId, workspaceIds))
        .groupBy(invoices.workspaceId),
      db
        .select({
          workspaceId: issuerBusinesses.workspaceId,
          value: count(),
        })
        .from(issuerBusinesses)
        .where(inArray(issuerBusinesses.workspaceId, workspaceIds))
        .groupBy(issuerBusinesses.workspaceId),
      db
        .select({
          workspaceId: aiTokenBalances.workspaceId,
          remaining: sql<number>`${aiTokenBalances.giftedRemaining} + ${aiTokenBalances.monthlyRemaining} + ${aiTokenBalances.purchasedRemaining}`,
        })
        .from(aiTokenBalances)
        .where(inArray(aiTokenBalances.workspaceId, workspaceIds)),
      db
        .select({
          workspaceId: aiUsageEvents.workspaceId,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
        })
        .from(aiUsageEvents)
        .where(
          and(
            inArray(aiUsageEvents.workspaceId, workspaceIds),
            sql`${aiUsageEvents.kind} = 'llm'`,
            gte(aiUsageEvents.createdAt, window30d),
          ),
        )
        .groupBy(aiUsageEvents.workspaceId),
    ]);

  const membersByWorkspace = new Map(
    memberCounts.map((row) => [row.workspaceId, Number(row.value)]),
  );
  const invoicesByWorkspace = new Map(
    invoiceCounts.map((row) => [row.workspaceId, Number(row.value)]),
  );
  const issuersByWorkspace = new Map(
    issuerCounts.map((row) => [row.workspaceId, Number(row.value)]),
  );
  const tokensByWorkspace = new Map(
    tokenRows.map((row) => [row.workspaceId, Number(row.remaining) || 0]),
  );
  const burnByWorkspace = new Map(
    burnRows.map((row) => [row.workspaceId, Number(row.tokens) || 0]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.createdAt,
    planName: r.planName,
    memberCount: membersByWorkspace.get(r.id) ?? 0,
    invoiceCount: invoicesByWorkspace.get(r.id) ?? 0,
    issuerCount: issuersByWorkspace.get(r.id) ?? 0,
    tokensRemaining: tokensByWorkspace.get(r.id) ?? 0,
    aiBurn30d: burnByWorkspace.get(r.id) ?? 0,
    frozenAt: r.frozenAt,
  }));
}

export async function adminListInvoices(): Promise<AdminInvoiceRow[]> {
  const todayIso = pragueTodayIso();

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: invoices.clientName,
      workspaceId: invoices.workspaceId,
      workspaceName: workspaces.name,
      issuerId: invoices.issuerId,
      issuerSnapshot: invoices.issuerSnapshot,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      issuedAt: invoices.issuedAt,
      paidAt: invoices.paidAt,
      cancelledAt: invoices.cancelledAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .innerJoin(workspaces, eq(invoices.workspaceId, workspaces.id))
    .where(notUnclaimedWorkspaces())
    .orderBy(desc(invoices.updatedAt))
    .limit(ADMIN_LIST_CAP);

  return rows.map((row) => {
    const issuerName = snapshotString(row.issuerSnapshot, "name") ?? "—";
    return {
      id: row.id,
      number: row.number,
      clientName: row.clientName,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      issuerId: row.issuerId,
      issuerName,
      total: row.total,
      currency: row.currency,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      updatedAt: row.updatedAt,
      displayStatus: resolveDisplayStatus(
        {
          issuedAt: row.issuedAt,
          dueDate: row.dueDate,
          paidAt: row.paidAt,
          cancelledAt: row.cancelledAt,
          issueDate: row.issueDate,
        },
        todayIso,
      ),
    };
  });
}

export async function adminListIssuers(): Promise<AdminIssuerRow[]> {
  const rows = await db
    .select({
      id: issuerBusinesses.id,
      workspaceId: issuerBusinesses.workspaceId,
      workspaceName: workspaces.name,
      source: issuerBusinesses.source,
      snapshot: issuerBusinesses.snapshot,
      updatedAt: issuerBusinesses.updatedAt,
    })
    .from(issuerBusinesses)
    .innerJoin(workspaces, eq(issuerBusinesses.workspaceId, workspaces.id))
    .where(notUnclaimedWorkspaces())
    .orderBy(desc(issuerBusinesses.updatedAt))
    .limit(ADMIN_LIST_CAP);

  return rows.map((r) => {
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      workspaceName: r.workspaceName,
      name: snapshotString(r.snapshot, "name") ?? "—",
      ico: snapshotString(r.snapshot, "ico"),
      dic: snapshotString(r.snapshot, "dic"),
      source: r.source,
      updatedAt: r.updatedAt,
    };
  });
}
