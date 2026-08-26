import "server-only";

import {
  aiTokenBalances,
  invitation,
  invoices,
  issuerBusinesses,
  member,
  referralEvents,
  securityAuditEvents,
  user,
  workspaces,
  type PlatformRole,
  type SecurityAuditEventType,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

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

  const [memberships, referredUsers, referredByRows, auditEvents] =
    await Promise.all([
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
    issuers: issuers.map((issuer) => {
      const snapshot = issuer.snapshot as { name?: unknown; ico?: unknown };
      return {
        id: issuer.id,
        name: typeof snapshot.name === "string" ? snapshot.name : "—",
        ico: typeof snapshot.ico === "string" ? snapshot.ico : null,
      };
    }),
    invoiceCount: invoiceCountRows[0]?.value ?? 0,
    tokens: tokenRows[0] ?? null,
    auditEvents,
  };
}

/** Every platform-admin write, newest first — the console's own paper trail. */
export async function adminListPlatformAuditEvents(
  limit = 200,
): Promise<AdminAuditRow[]> {
  const PLATFORM_TYPES: SecurityAuditEventType[] = [
    "platform_admin_grant",
    "platform_admin_revoke",
    "platform_tokens_grant",
    "platform_workspace_rename",
    "platform_workspace_delete",
    "platform_member_remove",
    "platform_invite_cancel",
  ];

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
    .where(inArray(securityAuditEvents.type, PLATFORM_TYPES))
    .orderBy(desc(securityAuditEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorEmail: row.actorEmail,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
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
