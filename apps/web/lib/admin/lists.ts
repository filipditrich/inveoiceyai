import "server-only";

import { pragueTodayIso } from "@/lib/invoice-status-sql";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import {
  issuerBusinesses,
  invoices,
  member,
  user,
  workspaces,
  type PlatformRole,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, desc, eq, sql } from "drizzle-orm";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  platformRole: PlatformRole;
  defaultWorkspaceId: string | null;
  createdAt: Date;
  membershipCount: number;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  invoiceCount: number;
  issuerCount: number;
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

const ADMIN_LIST_CAP = 2000;

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      platformRole: user.platformRole,
      defaultWorkspaceId: user.defaultWorkspaceId,
      createdAt: user.createdAt,
      membershipCount: sql<number>`cast(count(${member.id}) as int)`,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .groupBy(
      user.id,
      user.name,
      user.email,
      user.emailVerified,
      user.platformRole,
      user.defaultWorkspaceId,
      user.createdAt,
    )
    .orderBy(desc(user.createdAt))
    .limit(ADMIN_LIST_CAP);

  return rows.map((r) => ({
    ...r,
    platformRole: r.platformRole === "admin" ? "admin" : "none",
    membershipCount: Number(r.membershipCount ?? 0),
  }));
}

export async function adminListWorkspaces(): Promise<AdminWorkspaceRow[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      memberCount: sql<number>`(
        select cast(count(*) as int) from ${member}
        where ${member.organizationId} = ${workspaces.id}
      )`,
      invoiceCount: sql<number>`(
        select cast(count(*) as int) from ${invoices}
        where ${invoices.workspaceId} = ${workspaces.id}
      )`,
      issuerCount: sql<number>`(
        select cast(count(*) as int) from ${issuerBusinesses}
        where ${issuerBusinesses.workspaceId} = ${workspaces.id}
      )`,
    })
    .from(workspaces)
    .orderBy(asc(workspaces.name))
    .limit(ADMIN_LIST_CAP);

  return rows.map((r) => ({
    ...r,
    memberCount: Number(r.memberCount ?? 0),
    invoiceCount: Number(r.invoiceCount ?? 0),
    issuerCount: Number(r.issuerCount ?? 0),
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
    .orderBy(desc(invoices.updatedAt))
    .limit(ADMIN_LIST_CAP);

  return rows.map((row) => {
    const snap = row.issuerSnapshot as { name?: unknown };
    const issuerName = typeof snap.name === "string" ? snap.name : "—";
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
    .orderBy(desc(issuerBusinesses.updatedAt))
    .limit(ADMIN_LIST_CAP);

  return rows.map((r) => {
    const snap = r.snapshot as {
      name?: unknown;
      ico?: unknown;
      dic?: unknown;
    };
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      workspaceName: r.workspaceName,
      name: typeof snap.name === "string" ? snap.name : "—",
      ico: typeof snap.ico === "string" ? snap.ico : null,
      dic: typeof snap.dic === "string" ? snap.dic : null,
      source: r.source,
      updatedAt: r.updatedAt,
    };
  });
}
