import "server-only";
import { pragueTodayIso } from "@/lib/invoice-status-sql";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  aiTokenBalances,
  emailMessages,
  invitation,
  invoiceImportBatches,
  invoices,
  issuerBusinesses,
  member,
  referralEvents,
  securityAuditEvents,
  session,
  user,
  workspaces,
  type PlatformRole,
  type SecurityAuditEventType,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import { PLATFORM_AUDIT_TYPES } from "./constants";
import { snapshotString } from "./snapshot";

/** Detail pages read one tenant at a time; lists stay in `lists.ts`. */
const DETAIL_ROW_CAP = 50;

export type AdminAuditRow = {
  id: string;
  type: SecurityAuditEventType;
  actorEmail: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  platformRole: PlatformRole;
  defaultWorkspaceId: string | null;
  createdAt: Date;
  referredByEmail: string | null;
  lastSeenAt: Date | null;
  memberships: {
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    role: string;
    joinedAt: Date;
  }[];
  referredUsers: { email: string; createdAt: Date }[];
  auditEvents: AdminAuditRow[];
};

export type AdminWorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  members: {
    userId: string;
    name: string;
    email: string;
    role: string;
    joinedAt: Date;
  }[];
  pendingInvites: {
    id: string;
    email: string;
    role: string | null;
    expiresAt: Date;
    inviterEmail: string | null;
  }[];
  issuers: { id: string; name: string; ico: string | null }[];
  invoiceCount: number;
  tokens: {
    giftedRemaining: number;
    monthlyRemaining: number;
    monthlyLimit: number;
    purchasedRemaining: number;
    periodEnd: Date;
  } | null;
  frozenAt: Date | null;
  frozenBy: string | null;
  freezeReason: string | null;
  auditEvents: AdminAuditRow[];
};

/** Audit rows carry ids; resolve them to emails/names so the log is readable. */
async function loadAuditRows(
  filter: "user" | "workspace",
  id: string,
): Promise<AdminAuditRow[]> {
  const rows = await db
    .select({
      id: securityAuditEvents.id,
      type: securityAuditEvents.type,
      workspaceId: securityAuditEvents.workspaceId,
      metadata: securityAuditEvents.metadata,
      createdAt: securityAuditEvents.createdAt,
      actorEmail: user.email,
      workspaceName: workspaces.name,
    })
    .from(securityAuditEvents)
    .leftJoin(user, eq(securityAuditEvents.userId, user.id))
    .leftJoin(workspaces, eq(securityAuditEvents.workspaceId, workspaces.id))
    .where(
      filter === "user"
        ? eq(securityAuditEvents.userId, id)
        : eq(securityAuditEvents.workspaceId, id),
    )
    .orderBy(desc(securityAuditEvents.createdAt))
    .limit(DETAIL_ROW_CAP);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorEmail: row.actorEmail,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    /** SAFETY: audit metadata is opaque jsonb; the console only displays it. */
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }));
}

export async function adminGetUser(
  userId: string,
): Promise<AdminUserDetail | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      platformRole: user.platformRole,
      defaultWorkspaceId: user.defaultWorkspaceId,
      createdAt: user.createdAt,
      referredByUserId: user.referredByUserId,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) return null;

  const [
    memberships,
    referredUsers,
    referredByRows,
    auditEvents,
    lastSeenRows,
  ] = await Promise.all([
    db
      .select({
        workspaceId: member.organizationId,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(workspaces, eq(member.organizationId, workspaces.id))
      .where(eq(member.userId, userId))
      .orderBy(desc(member.createdAt))
      .limit(DETAIL_ROW_CAP),
    db
      .select({ email: user.email, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.referredByUserId, userId))
      .orderBy(desc(user.createdAt))
      .limit(DETAIL_ROW_CAP),
    row.referredByUserId
      ? db
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, row.referredByUserId))
          .limit(1)
      : Promise.resolve([]),
    loadAuditRows("user", userId),
    db
      .select({ lastSeenAt: sql<Date>`max(${session.updatedAt})` })
      .from(session)
      .where(eq(session.userId, userId)),
  ]);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    platformRole: row.platformRole,
    defaultWorkspaceId: row.defaultWorkspaceId,
    createdAt: row.createdAt,
    referredByEmail: referredByRows[0]?.email ?? null,
    lastSeenAt: lastSeenRows[0]?.lastSeenAt ?? null,
    memberships,
    referredUsers,
    auditEvents,
  };
}

export async function adminGetWorkspace(
  workspaceId: string,
): Promise<AdminWorkspaceDetail | null> {
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logo: workspaces.logo,
      createdAt: workspaces.createdAt,
      frozenAt: workspaces.frozenAt,
      frozenBy: workspaces.frozenBy,
      freezeReason: workspaces.freezeReason,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!row) return null;

  const [
    members,
    pendingInvites,
    issuers,
    invoiceCountRows,
    tokenRows,
    auditEvents,
  ] = await Promise.all([
    db
      .select({
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, workspaceId))
      .orderBy(desc(member.createdAt))
      .limit(DETAIL_ROW_CAP),
    db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviterEmail: user.email,
      })
      .from(invitation)
      .leftJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.organizationId, workspaceId),
          eq(invitation.status, "pending"),
        ),
      )
      .orderBy(desc(invitation.createdAt))
      .limit(DETAIL_ROW_CAP),
    db
      .select({
        id: issuerBusinesses.id,
        snapshot: issuerBusinesses.snapshot,
      })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, workspaceId))
      .limit(DETAIL_ROW_CAP),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.workspaceId, workspaceId)),
    db
      .select({
        giftedRemaining: aiTokenBalances.giftedRemaining,
        monthlyRemaining: aiTokenBalances.monthlyRemaining,
        monthlyLimit: aiTokenBalances.monthlyLimit,
        purchasedRemaining: aiTokenBalances.purchasedRemaining,
        periodEnd: aiTokenBalances.periodEnd,
      })
      .from(aiTokenBalances)
      .where(eq(aiTokenBalances.workspaceId, workspaceId))
      .limit(1),
    loadAuditRows("workspace", workspaceId),
  ]);

  return {
    ...row,
    members,
    pendingInvites,
    // Issuer name and IČO live inside the snapshot jsonb, not as columns.
    issuers: issuers.map((issuer) => ({
      id: issuer.id,
      name: snapshotString(issuer.snapshot, "name") ?? "—",
      ico: snapshotString(issuer.snapshot, "ico"),
    })),
    invoiceCount: invoiceCountRows[0]?.value ?? 0,
    tokens: tokenRows[0] ?? null,
    auditEvents,
  };
}

/** Every platform-admin write, newest first — the console's own paper trail. */
export async function adminListPlatformAuditEvents(
  limit = 200,
): Promise<AdminAuditRow[]> {
  const rows = await db
    .select({
      id: securityAuditEvents.id,
      type: securityAuditEvents.type,
      workspaceId: securityAuditEvents.workspaceId,
      metadata: securityAuditEvents.metadata,
      createdAt: securityAuditEvents.createdAt,
      actorEmail: user.email,
      workspaceName: workspaces.name,
    })
    .from(securityAuditEvents)
    .leftJoin(user, eq(securityAuditEvents.userId, user.id))
    .leftJoin(workspaces, eq(securityAuditEvents.workspaceId, workspaces.id))
    .where(inArray(securityAuditEvents.type, [...PLATFORM_AUDIT_TYPES]))
    .orderBy(desc(securityAuditEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorEmail: row.actorEmail,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    /** SAFETY: audit metadata is opaque jsonb; the console only displays it. */
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
  }));
}

/** Referral attribution rollup, used on the user detail page. */
export async function adminCountReferralEvents(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(referralEvents)
    .where(eq(referralEvents.referrerUserId, userId));
  return row?.value ?? 0;
}

export type AdminInvoiceEmailRow = {
  id: string;
  toEmail: string;
  status: string;
  template: string;
  createdAt: Date;
};

export type AdminInvoiceDetail = {
  id: string;
  number: string | null;
  docType: string;
  clientName: string;
  total: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  issuedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  displayStatus: InvoiceDisplayStatus;
  workspaceId: string;
  workspaceName: string;
  issuerId: string;
  issuerName: string;
  pdfUrl: string | null;
  isdocUrl: string | null;
  originProvider: string | null;
  originLabel: string | null;
  originVersion: string | null;
  importCompleteness: string | null;
  importedAt: Date | null;
  artifactsImmutable: boolean;
  importBatch: {
    id: string;
    originProvider: string;
    createdCount: number;
    skippedCount: number;
    failedCount: number;
    createdAt: Date;
  } | null;
  emails: AdminInvoiceEmailRow[];
};

export async function adminGetInvoice(
  invoiceId: string,
): Promise<AdminInvoiceDetail | null> {
  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      docType: invoices.docType,
      clientName: invoices.clientName,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      issuedAt: invoices.issuedAt,
      paidAt: invoices.paidAt,
      cancelledAt: invoices.cancelledAt,
      workspaceId: invoices.workspaceId,
      workspaceName: workspaces.name,
      issuerId: invoices.issuerId,
      issuerSnapshot: invoices.issuerSnapshot,
      pdfUrl: invoices.pdfUrl,
      isdocUrl: invoices.isdocUrl,
      originProvider: invoices.originProvider,
      originLabel: invoices.originLabel,
      originVersion: invoices.originVersion,
      importCompleteness: invoices.importCompleteness,
      importedAt: invoices.importedAt,
      artifactsImmutable: invoices.artifactsImmutable,
      importBatchId: invoices.importBatchId,
    })
    .from(invoices)
    .innerJoin(workspaces, eq(invoices.workspaceId, workspaces.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!row) return null;

  const [emails, batchRows] = await Promise.all([
    db
      .select({
        id: emailMessages.id,
        toEmail: emailMessages.toEmail,
        status: emailMessages.status,
        template: emailMessages.template,
        createdAt: emailMessages.createdAt,
      })
      .from(emailMessages)
      .where(eq(emailMessages.invoiceId, invoiceId))
      .orderBy(desc(emailMessages.createdAt))
      .limit(DETAIL_ROW_CAP),
    row.importBatchId
      ? db
          .select({
            id: invoiceImportBatches.id,
            originProvider: invoiceImportBatches.originProvider,
            createdCount: invoiceImportBatches.createdCount,
            skippedCount: invoiceImportBatches.skippedCount,
            failedCount: invoiceImportBatches.failedCount,
            createdAt: invoiceImportBatches.createdAt,
          })
          .from(invoiceImportBatches)
          .where(eq(invoiceImportBatches.id, row.importBatchId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: row.id,
    number: row.number,
    docType: row.docType,
    clientName: row.clientName,
    total: row.total,
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    issuedAt: row.issuedAt,
    paidAt: row.paidAt,
    cancelledAt: row.cancelledAt,
    displayStatus: resolveDisplayStatus(
      {
        issuedAt: row.issuedAt,
        dueDate: row.dueDate,
        paidAt: row.paidAt,
        cancelledAt: row.cancelledAt,
        issueDate: row.issueDate,
      },
      pragueTodayIso(),
    ),
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    issuerId: row.issuerId,
    issuerName: snapshotString(row.issuerSnapshot, "name") ?? "—",
    pdfUrl: row.pdfUrl,
    isdocUrl: row.isdocUrl,
    originProvider: row.originProvider,
    originLabel: row.originLabel,
    originVersion: row.originVersion,
    importCompleteness: row.importCompleteness,
    importedAt: row.importedAt,
    artifactsImmutable: row.artifactsImmutable === 1,
    importBatch: batchRows[0] ?? null,
    emails,
  };
}

export type AdminIssuerInvoiceRow = {
  id: string;
  number: string | null;
  clientName: string;
  total: string;
  currency: string;
  issueDate: string;
  displayStatus: InvoiceDisplayStatus;
};

export type AdminIssuerDetail = {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  source: string;
  updatedAt: Date;
  workspaceId: string;
  workspaceName: string;
  invoiceCount: number;
  invoices: AdminIssuerInvoiceRow[];
};

export async function adminGetIssuer(
  issuerId: string,
): Promise<AdminIssuerDetail | null> {
  const [row] = await db
    .select({
      id: issuerBusinesses.id,
      snapshot: issuerBusinesses.snapshot,
      source: issuerBusinesses.source,
      updatedAt: issuerBusinesses.updatedAt,
      workspaceId: issuerBusinesses.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(issuerBusinesses)
    .innerJoin(workspaces, eq(issuerBusinesses.workspaceId, workspaces.id))
    .where(eq(issuerBusinesses.id, issuerId))
    .limit(1);

  if (!row) return null;

  const todayIso = pragueTodayIso();
  const [countRows, invoiceRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.issuerId, issuerId)),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        total: invoices.total,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        issuedAt: invoices.issuedAt,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        cancelledAt: invoices.cancelledAt,
      })
      .from(invoices)
      .where(eq(invoices.issuerId, issuerId))
      .orderBy(desc(invoices.updatedAt))
      .limit(DETAIL_ROW_CAP),
  ]);

  return {
    id: row.id,
    name: snapshotString(row.snapshot, "name") ?? "—",
    ico: snapshotString(row.snapshot, "ico"),
    dic: snapshotString(row.snapshot, "dic"),
    source: row.source,
    updatedAt: row.updatedAt,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    invoiceCount: countRows[0]?.value ?? 0,
    invoices: invoiceRows.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      clientName: invoice.clientName,
      total: invoice.total,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      displayStatus: resolveDisplayStatus(
        {
          issuedAt: invoice.issuedAt,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          cancelledAt: invoice.cancelledAt,
          issueDate: invoice.issueDate,
        },
        todayIso,
      ),
    })),
  };
}
