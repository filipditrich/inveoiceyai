import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  DEFAULT_DRIVE_LAYOUT_TEMPLATE,
  applyDriveLayout,
  disambiguateDriveTitles,
  parseDriveLayoutTemplate,
  resolveDriveLayoutTemplate,
  sanitizeDriveSegment,
  type DriveLayoutParseError,
} from "@invoicey/invoice-core/drive-layout";
import type { InvoiceLanguage } from "@invoicey/invoice-core/schema";
import {
  pragueTodayIso,
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import { driveIndexEtag } from "./drive-index-etag";

export { DEFAULT_DRIVE_LAYOUT_TEMPLATE };

import { member } from "./auth-schema";
import type { InvoiceyDb } from "./create-db";
import {
  driveDevices,
  drivePairGrants,
  driveUserSettings,
} from "./drive-schema";
import { invoices, issuerBusinesses } from "./schema";
import { workspaces } from "./workspaces";

export const DRIVE_PAIR_GRANT_TTL_MS = 5 * 60 * 1000;

export interface DriveUserSettingsRow {
  userId: string;
  layoutTemplate: string;
  includeIsdoc: boolean;
  hiddenWorkspaceIds: string[];
}

export interface DriveDeviceRow {
  id: string;
  userId: string;
  name: string;
  tokenFingerprint: string;
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface DriveIndexItem {
  invoiceId: string;
  workspaceId: string;
  issuerId: string;
  workspaceName: string;
  issuerName: string;
  layoutRelPath: string;
  pdfSha256: string;
  isdocSha256: string;
  hasIsdoc: boolean;
  includeIsdoc: boolean;
  issuedAt: string;
  docType: string;
  displayStatus: InvoiceDisplayStatus;
}

function invoiceLanguageCode(
  language: string | null | undefined,
): InvoiceLanguage {
  if (language === "en" || language === "cs") {
    return language;
  }
  return "cs";
}

function invoiceLanguage(
  payload: Record<string, unknown> | null | undefined,
): InvoiceLanguage {
  const meta = payload?.meta;
  if (meta && typeof meta === "object" && "language" in meta) {
    /** SAFETY: `meta` is a JSON object; `language` is an optional string */
    const language = (meta as { language?: unknown }).language;
    return invoiceLanguageCode(typeof language === "string" ? language : null);
  }
  return "cs";
}

function isDriveImportWithoutPdf(invoice: {
  artifactsImmutable: number;
  importCompleteness: string | null;
}): boolean {
  return (
    invoice.artifactsImmutable === 1 || Boolean(invoice.importCompleteness)
  );
}

export async function getDriveUserSettings(
  db: InvoiceyDb,
  userId: string,
): Promise<DriveUserSettingsRow> {
  const [row] = await db
    .select()
    .from(driveUserSettings)
    .where(eq(driveUserSettings.userId, userId))
    .limit(1);
  if (!row) {
    return {
      userId,
      layoutTemplate: DEFAULT_DRIVE_LAYOUT_TEMPLATE,
      includeIsdoc: false,
      hiddenWorkspaceIds: [],
    };
  }
  return {
    userId: row.userId,
    layoutTemplate: resolveDriveLayoutTemplate(row.layoutTemplate),
    includeIsdoc: row.includeIsdoc,
    hiddenWorkspaceIds: Array.isArray(row.hiddenWorkspaceIds)
      ? row.hiddenWorkspaceIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
  };
}

export async function upsertDriveUserSettings(
  db: InvoiceyDb,
  input: {
    userId: string;
    layoutTemplate?: string;
    includeIsdoc?: boolean;
    hiddenWorkspaceIds?: string[];
  },
): Promise<{ ok: true } | { ok: false; error: DriveLayoutParseError }> {
  const current = await getDriveUserSettings(db, input.userId);
  const layoutTemplate =
    input.layoutTemplate === undefined
      ? current.layoutTemplate
      : input.layoutTemplate;
  const parsed = parseDriveLayoutTemplate(layoutTemplate);
  if (!parsed.ok) {
    return parsed;
  }
  const includeIsdoc = input.includeIsdoc ?? current.includeIsdoc;
  const hiddenWorkspaceIds =
    input.hiddenWorkspaceIds ?? current.hiddenWorkspaceIds;
  await db
    .insert(driveUserSettings)
    .values({
      userId: input.userId,
      layoutTemplate: parsed.template,
      includeIsdoc,
      hiddenWorkspaceIds,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: driveUserSettings.userId,
      set: {
        layoutTemplate: parsed.template,
        includeIsdoc,
        hiddenWorkspaceIds,
        updatedAt: new Date(),
      },
    });
  return { ok: true };
}

export async function insertDrivePairGrant(
  db: InvoiceyDb,
  input: {
    userId: string;
    codeHash: string;
    codeChallenge: string;
    redirectUri: string;
    deviceName: string | null;
  },
): Promise<{ id: string; expiresAt: Date }> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + DRIVE_PAIR_GRANT_TTL_MS);
  await db.insert(drivePairGrants).values({
    id,
    userId: input.userId,
    codeHash: input.codeHash,
    codeChallenge: input.codeChallenge,
    redirectUri: input.redirectUri,
    deviceName: input.deviceName,
    expiresAt,
  });
  return { id, expiresAt };
}

export async function consumeDrivePairGrant(
  db: InvoiceyDb,
  codeHash: string,
  now = new Date(),
): Promise<{
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  deviceName: string | null;
} | null> {
  const [row] = await db
    .select()
    .from(drivePairGrants)
    .where(eq(drivePairGrants.codeHash, codeHash))
    .limit(1);
  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  await db
    .update(drivePairGrants)
    .set({ usedAt: now })
    .where(eq(drivePairGrants.id, row.id));
  return {
    userId: row.userId,
    codeChallenge: row.codeChallenge,
    redirectUri: row.redirectUri,
    deviceName: row.deviceName,
  };
}

export async function insertDriveDevice(
  db: InvoiceyDb,
  input: {
    userId: string;
    name: string;
    tokenHash: string;
    tokenFingerprint: string;
  },
): Promise<DriveDeviceRow> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(driveDevices).values({
    id,
    userId: input.userId,
    name: input.name,
    tokenHash: input.tokenHash,
    tokenFingerprint: input.tokenFingerprint,
    lastSeenAt: now,
    createdAt: now,
  });
  return {
    id,
    userId: input.userId,
    name: input.name,
    tokenFingerprint: input.tokenFingerprint,
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
  };
}

export async function findActiveDriveDeviceByTokenHash(
  db: InvoiceyDb,
  tokenHash: string,
): Promise<{ id: string; userId: string; name: string } | null> {
  const [row] = await db
    .select({
      id: driveDevices.id,
      userId: driveDevices.userId,
      name: driveDevices.name,
    })
    .from(driveDevices)
    .where(
      and(
        eq(driveDevices.tokenHash, tokenHash),
        isNull(driveDevices.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function touchDriveDevice(
  db: InvoiceyDb,
  deviceId: string,
): Promise<void> {
  await db
    .update(driveDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(driveDevices.id, deviceId));
}

export async function listDriveDevicesForUser(
  db: InvoiceyDb,
  userId: string,
): Promise<DriveDeviceRow[]> {
  const rows = await db
    .select()
    .from(driveDevices)
    .where(eq(driveDevices.userId, userId))
    .orderBy(desc(driveDevices.createdAt));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    tokenFingerprint: row.tokenFingerprint,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }));
}

export async function revokeDriveDevice(input: {
  db: InvoiceyDb;
  userId: string;
  deviceId: string;
}): Promise<boolean> {
  const [row] = await input.db
    .select({ id: driveDevices.id })
    .from(driveDevices)
    .where(
      and(
        eq(driveDevices.id, input.deviceId),
        eq(driveDevices.userId, input.userId),
        isNull(driveDevices.revokedAt),
      ),
    )
    .limit(1);
  if (!row) {
    return false;
  }
  await input.db
    .update(driveDevices)
    .set({ revokedAt: new Date() })
    .where(eq(driveDevices.id, row.id));
  return true;
}

export async function countActiveDriveDevices(
  db: InvoiceyDb,
  userId: string,
): Promise<number> {
  const rows = await listDriveDevicesForUser(db, userId);
  return rows.filter((row) => row.revokedAt == null).length;
}

export async function revokeDriveDeviceByTokenHash(
  db: InvoiceyDb,
  tokenHash: string,
): Promise<{ userId: string; deviceId: string } | null> {
  const device = await findActiveDriveDeviceByTokenHash(db, tokenHash);
  if (!device) {
    return null;
  }
  await db
    .update(driveDevices)
    .set({ revokedAt: new Date() })
    .where(eq(driveDevices.id, device.id));
  return { userId: device.userId, deviceId: device.id };
}

export async function listMemberWorkspaces(
  db: InvoiceyDb,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(member)
    .innerJoin(workspaces, eq(workspaces.id, member.organizationId))
    .where(eq(member.userId, userId));
}

interface DriveIndexScope {
  settings: DriveUserSettingsRow;
  visible: { id: string; name: string }[];
}

function driveIndexScope(
  settings: DriveUserSettingsRow,
  memberships: { id: string; name: string }[],
): DriveIndexScope {
  const hidden = new Set(settings.hiddenWorkspaceIds);
  return {
    settings,
    visible: memberships.filter((workspace) => !hidden.has(workspace.id)),
  };
}

function issuedInvoiceWhere(workspaceIds: string[]) {
  return and(
    inArray(invoices.workspaceId, workspaceIds),
    isNotNull(invoices.issuedAt),
    isNull(invoices.cancelledAt),
  );
}

/**
 * Validator for the Drive index. The aggregate hashes ids and timestamps
 * inside Postgres so an unchanged tree does not ship invoice payloads.
 */
export async function readDriveIndexEtag(
  db: InvoiceyDb,
  userId: string,
): Promise<string> {
  const settings = await getDriveUserSettings(db, userId);
  const memberships = await listMemberWorkspaces(db, userId);
  const scope = driveIndexScope(settings, memberships);
  const stamps = await readDriveIndexStamps(
    db,
    scope.visible.map((workspace) => workspace.id),
  );
  return driveIndexEtag({
    pragueDate: pragueTodayIso(),
    layoutTemplate: scope.settings.layoutTemplate,
    includeIsdoc: scope.settings.includeIsdoc,
    hiddenWorkspaceIds: scope.settings.hiddenWorkspaceIds,
    workspaces: scope.visible,
    invoiceCount: stamps.invoiceCount,
    invoiceStamp: stamps.invoiceStamp,
    issuerStamp: stamps.issuerStamp,
  });
}

async function readDriveIndexStamps(
  db: InvoiceyDb,
  workspaceIds: string[],
): Promise<{
  invoiceCount: number;
  invoiceStamp: string;
  issuerStamp: string;
}> {
  if (workspaceIds.length === 0) {
    return { invoiceCount: 0, invoiceStamp: "", issuerStamp: "" };
  }
  const [row] = await db
    .select({
      invoiceCount: count(),
      invoiceStamp: sql<string>`md5(coalesce(string_agg(${invoices.id}::text || '|' || coalesce(${invoices.updatedAt}::text, ''), ',' order by ${invoices.id}::text), ''))`,
      issuerStamp: sql<string>`md5(coalesce(string_agg(${issuerBusinesses.id}::text || '|' || coalesce(${issuerBusinesses.updatedAt}::text, '') || '|' || coalesce(${issuerBusinesses.snapshot}->>'name', ''), ',' order by ${issuerBusinesses.id}::text), ''))`,
    })
    .from(invoices)
    .innerJoin(issuerBusinesses, eq(issuerBusinesses.id, invoices.issuerId))
    .where(issuedInvoiceWhere(workspaceIds));
  return {
    invoiceCount: Number(row?.invoiceCount ?? 0),
    invoiceStamp: row?.invoiceStamp ?? "",
    issuerStamp: row?.issuerStamp ?? "",
  };
}

interface DriveIndexInvoiceRow {
  id: string;
  workspaceId: string;
  issuerId: string;
  issueDate: string;
  number: string | null;
  docType: string;
  clientName: string;
  issuedAt: Date | null;
  dueDate: string;
  paidAt: Date | null;
  cancelledAt: Date | null;
  pdfUrl: string | null;
  isdocUrl: string | null;
  pdfSha256: string | null;
  isdocSha256: string | null;
  artifactsImmutable: number;
  importCompleteness: string | null;
  language: string | null;
  issuerName: string | null;
}

export async function listDriveIndex(
  db: InvoiceyDb,
  userId: string,
): Promise<DriveIndexItem[]> {
  const settings = await getDriveUserSettings(db, userId);
  const memberships = await listMemberWorkspaces(db, userId);
  const scope = driveIndexScope(settings, memberships);
  if (scope.visible.length === 0) {
    return [];
  }
  const workspaceIds = scope.visible.map((workspace) => workspace.id);
  const rows = await db
    .select({
      id: invoices.id,
      workspaceId: invoices.workspaceId,
      issuerId: invoices.issuerId,
      issueDate: invoices.issueDate,
      number: invoices.number,
      docType: invoices.docType,
      clientName: invoices.clientName,
      issuedAt: invoices.issuedAt,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      cancelledAt: invoices.cancelledAt,
      pdfUrl: invoices.pdfUrl,
      isdocUrl: invoices.isdocUrl,
      pdfSha256: invoices.pdfSha256,
      isdocSha256: invoices.isdocSha256,
      artifactsImmutable: invoices.artifactsImmutable,
      importCompleteness: invoices.importCompleteness,
      language: sql<
        string | null
      >`${invoices.payloadJson} -> 'meta' ->> 'language'`,
      issuerName: sql<string | null>`${issuerBusinesses.snapshot} ->> 'name'`,
    })
    .from(invoices)
    .innerJoin(issuerBusinesses, eq(issuerBusinesses.id, invoices.issuerId))
    .where(issuedInvoiceWhere(workspaceIds));
  return mapDriveIndexItems(rows, scope);
}

function mapDriveIndexItems(
  rows: DriveIndexInvoiceRow[],
  scope: DriveIndexScope,
): DriveIndexItem[] {
  const workspaceTitles = disambiguateDriveTitles(
    scope.visible.map((workspace) => ({
      id: workspace.id,
      name: sanitizeDriveSegment(workspace.name),
    })),
  );
  const issuersByWorkspace = new Map<string, { id: string; name: string }[]>();
  for (const row of rows) {
    const list = issuersByWorkspace.get(row.workspaceId) ?? [];
    if (!list.some((issuer) => issuer.id === row.issuerId)) {
      list.push({
        id: row.issuerId,
        name: driveIssuerName(row.issuerName),
      });
    }
    issuersByWorkspace.set(row.workspaceId, list);
  }
  const issuerTitles = new Map<string, string>();
  for (const [workspaceId, issuers] of issuersByWorkspace) {
    const titles = disambiguateDriveTitles(issuers);
    for (const [id, title] of titles) {
      issuerTitles.set(`${workspaceId}:${id}`, title);
    }
  }

  const todayIso = pragueTodayIso();
  const items: DriveIndexItem[] = [];
  for (const row of rows) {
    if (!row.issuedAt) {
      continue;
    }
    /** imports without a stored PDF cannot be rendered */
    if (!row.pdfUrl && isDriveImportWithoutPdf(row)) {
      continue;
    }
    const layout = applyDriveLayout({
      template: scope.settings.layoutTemplate,
      issueDate: row.issueDate,
      number: row.number ?? row.id,
      language: invoiceLanguageCode(row.language),
      docType: row.docType,
      clientName: row.clientName,
    });
    items.push({
      invoiceId: row.id,
      workspaceId: row.workspaceId,
      issuerId: row.issuerId,
      workspaceName: workspaceTitles.get(row.workspaceId) ?? row.workspaceId,
      issuerName:
        issuerTitles.get(`${row.workspaceId}:${row.issuerId}`) ?? "issuer",
      layoutRelPath: layout.relPath,
      pdfSha256: row.pdfSha256 ?? "",
      isdocSha256: row.isdocSha256 ?? "",
      hasIsdoc: Boolean(row.isdocUrl),
      includeIsdoc: scope.settings.includeIsdoc && Boolean(row.isdocUrl),
      issuedAt: row.issuedAt.toISOString(),
      docType: row.docType,
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
    });
  }
  return items;
}

function driveIssuerName(name: string | null): string {
  if (name && name.trim().length > 0) {
    return sanitizeDriveSegment(name);
  }
  return "issuer";
}

export async function getDriveIssuedInvoice(input: {
  db: InvoiceyDb;
  userId: string;
  invoiceId: string;
}): Promise<(typeof invoices)["$inferSelect"] | null> {
  const settings = await getDriveUserSettings(input.db, input.userId);
  const memberships = await listMemberWorkspaces(input.db, input.userId);
  const hidden = new Set(settings.hiddenWorkspaceIds);
  const workspaceIds = memberships
    .filter((workspace) => !hidden.has(workspace.id))
    .map((workspace) => workspace.id);
  if (workspaceIds.length === 0) {
    return null;
  }
  const [row] = await input.db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, input.invoiceId),
        inArray(invoices.workspaceId, workspaceIds),
        isNotNull(invoices.issuedAt),
        isNull(invoices.cancelledAt),
      ),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  if (!row.pdfUrl && isDriveImportWithoutPdf(row)) {
    return null;
  }
  return row;
}

export async function getDriveInvoiceArtifact(input: {
  db: InvoiceyDb;
  userId: string;
  invoiceId: string;
}): Promise<{
  pdfUrl: string | null;
  isdocUrl: string | null;
  pdfSha256: string | null;
  isdocSha256: string | null;
  number: string | null;
  issueDate: string;
  clientName: string;
  docType: string;
  language: InvoiceLanguage;
  workspaceId: string;
} | null> {
  const row = await getDriveIssuedInvoice(input);
  if (!row) {
    return null;
  }
  return {
    pdfUrl: row.pdfUrl,
    isdocUrl: row.isdocUrl,
    pdfSha256: row.pdfSha256,
    isdocSha256: row.isdocSha256,
    number: row.number,
    issueDate: row.issueDate,
    clientName: row.clientName,
    docType: row.docType,
    language: invoiceLanguage(row.payloadJson),
    workspaceId: row.workspaceId,
  };
}
