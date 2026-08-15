"use server";

import {
  DEFAULT_NUMBERING_TEMPLATES,
  ISSUER_DOC_TYPES,
  type IssuerDocType,
} from "@/lib/issuer-numbering";
import { dismissIssuerWelcomeForWorkspace } from "@/lib/issuer-welcome";
import { requireWorkspace } from "@/lib/auth/session";
import {
  BankAccountSchema,
  DicSchema,
  IcoSchema,
  IssuerSnapshotSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import {
  extractIsdocFromPdf,
  parseIssuerFromIsdoc,
} from "@invoicey/invoice-core";
import {
  invoices,
  invoiceTemplates,
  issuerBusinesses,
  issuerNumberingSchemes,
  type IssuerEmailSettings,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { withDbTransaction } from "@invoicey/db/transaction";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function optionalTrim(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

function defaultEmailSettings(): IssuerEmailSettings {
  return {
    defaultSubject: "Faktura {number} — {issuerName}",
    defaultCoverText:
      "Dobrý den,\n\nv příloze zasílám fakturu {number}.\n\nS pozdravem",
    displayNameTemplate: "{issuerName} via Invoicey",
    attachIsdocByDefault: true,
    overdueRemindersEnabled: false,
    overdueReminderIntervalDays: 7,
    sendPaymentReceivedEmail: false,
  };
}

function parseEmailSettings(formData: FormData): IssuerEmailSettings {
  const intervalRaw = optionalTrim(
    formData.get("emailOverdueReminderIntervalDays"),
  );
  const intervalParsed = intervalRaw ? Number(intervalRaw) : 7;
  return {
    defaultSubject:
      optionalTrim(formData.get("emailDefaultSubject")) ??
      "Faktura {number} — {issuerName}",
    defaultCoverText:
      optionalTrim(formData.get("emailDefaultCoverText")) ??
      "Dobrý den,\n\nv příloze zasílám fakturu {number}.\n\nS pozdravem",
    displayNameTemplate:
      optionalTrim(formData.get("emailDisplayNameTemplate")) ??
      "{issuerName} via Invoicey",
    attachIsdocByDefault: formData.get("emailAttachIsdocByDefault") !== "false",
    overdueRemindersEnabled:
      formData.get("emailOverdueRemindersEnabled") === "true",
    overdueReminderIntervalDays:
      Number.isFinite(intervalParsed) && intervalParsed > 0
        ? Math.floor(intervalParsed)
        : 7,
    sendPaymentReceivedEmail:
      formData.get("emailSendPaymentReceivedEmail") === "true",
  };
}

function normalizeZip(zipRaw: string): string {
  const compact = zipRaw.replace(/\s/g, "");
  if (compact.length === 5 && /^\d{5}$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return zipRaw.trim();
}

function hashesForPadding(padding: number): string {
  return `{${"#".repeat(padding)}}`;
}

function templateWithPadding(base: string, padding: number): string {
  const hashes = hashesForPadding(padding);
  if (/\{#+\}/.test(base)) {
    return base.replace(/\{#+\}/, hashes);
  }
  return `${base}${hashes}`;
}

async function upsertNumberingScheme(
  tx: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
  opts: {
    workspaceId: string;
    issuerId: string;
    docType: IssuerDocType;
    formData: FormData;
  },
): Promise<void> {
  const { workspaceId, issuerId, docType, formData } = opts;
  const templateRaw =
    optionalTrim(formData.get(`scheme_${docType}_template`)) ??
    DEFAULT_NUMBERING_TEMPLATES[docType];
  const resetPeriodRaw =
    optionalTrim(formData.get(`scheme_${docType}_resetPeriod`)) ?? "yearly";
  const resetPeriod = resetPeriodRaw === "never" ? "never" : "yearly";
  const paddingRaw = Number(
    optionalTrim(formData.get(`scheme_${docType}_padding`)) ?? "4",
  );
  const padding =
    Number.isFinite(paddingRaw) && paddingRaw >= 1 && paddingRaw <= 10
      ? Math.floor(paddingRaw)
      : 4;
  const counterRaw = Number(
    optionalTrim(formData.get(`scheme_${docType}_counter`)) ?? "0",
  );
  const counter =
    Number.isFinite(counterRaw) && counterRaw >= 0 ? Math.floor(counterRaw) : 0;
  const counterYearRaw = optionalTrim(
    formData.get(`scheme_${docType}_counterYear`),
  );
  const counterYear =
    resetPeriod === "yearly"
      ? Number(counterYearRaw ?? String(new Date().getFullYear()))
      : null;
  const template = templateWithPadding(templateRaw, padding);

  const existingScheme = await tx
    .select()
    .from(issuerNumberingSchemes)
    .where(
      and(
        eq(issuerNumberingSchemes.issuerId, issuerId),
        eq(issuerNumberingSchemes.docType, docType),
      ),
    )
    .limit(1);

  if (existingScheme[0]) {
    await tx
      .update(issuerNumberingSchemes)
      .set({
        template,
        resetPeriod,
        counter,
        counterYear: counterYear ?? null,
        padding,
        updatedAt: new Date(),
      })
      .where(eq(issuerNumberingSchemes.id, existingScheme[0].id));
    return;
  }

  await tx.insert(issuerNumberingSchemes).values({
    id: crypto.randomUUID(),
    workspaceId,
    issuerId,
    docType,
    template,
    resetPeriod,
    counter,
    counterYear: counterYear ?? null,
    padding,
  });
}

async function loadIssuerSnapshot(
  workspaceId: string,
  issuerId: string,
): Promise<{
  snapshot: IssuerSnapshot;
  source: string;
  emailSettings: IssuerEmailSettings;
} | null> {
  const rows = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  const parsed = IssuerSnapshotSchema.safeParse(row.snapshot);
  if (!parsed.success) {
    return null;
  }
  return {
    snapshot: parsed.data,
    source: row.source,
    emailSettings: row.emailSettings ?? {},
  };
}

function sectionErr(issuerId: string, section: string, code: string): never {
  redirect(
    `/issuers/${issuerId}/edit/${section}?invalid=${encodeURIComponent(code)}`,
  );
}

function revalidateIssuerPaths(issuerId?: string): void {
  revalidatePath("/issuers");
  revalidatePath("/dashboard");
  revalidatePath("/invoices/new");
  revalidatePath("/welcome");
  if (issuerId) {
    revalidatePath(`/issuers/${issuerId}/edit`);
  }
}

async function assignDefaultIssuer(
  tx: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
  workspaceId: string,
  issuerId: string,
): Promise<void> {
  await tx
    .update(issuerBusinesses)
    .set({ isDefault: false })
    .where(eq(issuerBusinesses.workspaceId, workspaceId));
  await tx
    .update(issuerBusinesses)
    .set({ isDefault: true })
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    );
}

function parseIdentityFromForm(formData: FormData):
  | {
      ok: true;
      name: string;
      ico: string;
      dic?: string;
      street: string;
      city: string;
      zip: string;
      contactEmail: string;
      vatPayer: boolean;
      registryNote?: string;
      source: "ares" | "manual";
    }
  | { ok: false; code: string } {
  const name = optionalTrim(formData.get("name")) ?? null;
  const street = optionalTrim(formData.get("street")) ?? null;
  const city = optionalTrim(formData.get("city")) ?? null;
  const zipNorm = optionalTrim(formData.get("zip"));
  const zipResolved = zipNorm ? normalizeZip(zipNorm) : null;
  const contactEmail = optionalTrim(formData.get("contactEmail")) ?? null;
  const vatPayer =
    formData.get("vatPayer") === "on" || formData.get("vatPayer") === "true";
  const registryNote = optionalTrim(formData.get("registryNote"));
  const sourceLabelRaw = formData.get("source")?.toString();
  const source = sourceLabelRaw === "ares" ? "ares" : "manual";

  if (!name || !street || !city || !zipResolved || !contactEmail) {
    return { ok: false, code: "required_fields" };
  }

  const icoRaw = optionalTrim(formData.get("ico"));
  if (!icoRaw) {
    return { ok: false, code: "bad_ico" };
  }
  const icoParsed = IcoSchema.safeParse(icoRaw.replace(/\s/g, ""));
  if (!icoParsed.success) {
    return { ok: false, code: "bad_ico" };
  }

  let dicParsed: string | undefined;
  const dicRaw = optionalTrim(formData.get("dic"));
  if (dicRaw) {
    const d = DicSchema.safeParse(dicRaw);
    if (!d.success) {
      return { ok: false, code: "bad_dic" };
    }
    dicParsed = d.data;
  }

  return {
    ok: true,
    name,
    ico: icoParsed.data,
    ...(dicParsed !== undefined ? { dic: dicParsed } : {}),
    street,
    city,
    zip: zipResolved,
    contactEmail,
    vatPayer,
    ...(registryNote !== undefined ? { registryNote } : {}),
    source,
  };
}

function parseBankFromForm(
  formData: FormData,
): { ok: true; bank: IssuerSnapshot["bank"] } | { ok: false; code: string } {
  const accountNumber = optionalTrim(formData.get("accountNumber")) ?? null;
  const iban = optionalTrim(formData.get("iban")) ?? null;
  const bic = optionalTrim(formData.get("bic"));
  if (!accountNumber || !iban) {
    return { ok: false, code: "required_fields" };
  }
  const bankParsed = BankAccountSchema.safeParse({
    accountNumber,
    iban: iban.replace(/\s/g, "").toUpperCase(),
    ...(bic !== undefined ? { bic: bic.toUpperCase() } : {}),
  });
  if (!bankParsed.success) {
    return { ok: false, code: "bad_bank" };
  }
  return { ok: true, bank: bankParsed.data };
}

function parsePaymentQrFromForm(
  formData: FormData,
): IssuerSnapshot["paymentQr"] {
  const beneficiaryMessageTemplate = optionalTrim(
    formData.get("qrBeneficiaryMessageTemplate"),
  );
  const payerNoteTemplate = optionalTrim(formData.get("qrPayerNoteTemplate"));
  if (!beneficiaryMessageTemplate && !payerNoteTemplate) {
    return undefined;
  }
  return {
    ...(beneficiaryMessageTemplate ? { beneficiaryMessageTemplate } : {}),
    ...(payerNoteTemplate ? { payerNoteTemplate } : {}),
  };
}

/**
 * Create issuer with identity + bank; numbering and email get defaults.
 * Redirects to edit identity (or welcome done when `next=welcome`).
 */
export async function createIssuer(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const rowId = optionalTrim(formData.get("id")) ?? crypto.randomUUID();
  const next = optionalTrim(formData.get("next"));
  const errBase = next === "welcome" ? "/welcome" : "/issuers/new";

  const identity = parseIdentityFromForm(formData);
  if (!identity.ok) {
    redirect(`${errBase}?invalid=${encodeURIComponent(identity.code)}`);
  }
  const bank = parseBankFromForm(formData);
  if (!bank.ok) {
    redirect(`${errBase}?invalid=${encodeURIComponent(bank.code)}`);
  }

  const snapshotCandidate = IssuerSnapshotSchema.safeParse({
    id: rowId,
    name: identity.name,
    ico: identity.ico,
    ...(identity.dic !== undefined ? { dic: identity.dic } : {}),
    address: {
      street: identity.street,
      city: identity.city,
      zip: identity.zip,
      country: "CZ",
    },
    bank: bank.bank,
    vatPayer: identity.vatPayer,
    contactEmail: identity.contactEmail,
    ...(identity.registryNote !== undefined
      ? { registryNote: identity.registryNote }
      : {}),
  });

  if (!snapshotCandidate.success) {
    redirect(`${errBase}?invalid=${encodeURIComponent("snapshot_validation")}`);
  }

  const snapshot = snapshotCandidate.data;
  const emptyFd = new FormData();

  try {
    await withDbTransaction(async (tx) => {
      const [existing] = await tx
        .select({ id: issuerBusinesses.id })
        .from(issuerBusinesses)
        .where(eq(issuerBusinesses.workspaceId, workspaceId))
        .limit(1);
      await tx.insert(issuerBusinesses).values({
        id: snapshot.id,
        workspaceId,
        source: identity.source,
        snapshot: snapshot as Record<string, unknown>,
        emailSettings: defaultEmailSettings(),
        isDefault: existing == null,
      });

      for (const docType of ISSUER_DOC_TYPES) {
        await upsertNumberingScheme(tx, {
          workspaceId,
          issuerId: snapshot.id,
          docType,
          formData: emptyFd,
        });
      }
    });
  } catch (err) {
    console.error("[createIssuer] failed", err);
    redirect(`${errBase}?invalid=${encodeURIComponent("save_failed")}`);
  }

  revalidateIssuerPaths(snapshot.id);
  if (next === "welcome") {
    redirect(`/welcome?done=${encodeURIComponent(snapshot.id)}`);
  }
  redirect(`/issuers/${snapshot.id}/edit/identity?toast=issuer_saved`);
}

/** Update identity fields; keeps bank / assets intact. */
export async function saveIssuerIdentity(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const issuerId = optionalTrim(formData.get("id"));
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await loadIssuerSnapshot(workspaceId, issuerId);
  if (!existing) {
    sectionErr(issuerId, "identity", "missing_row");
  }

  const identity = parseIdentityFromForm(formData);
  if (!identity.ok) {
    sectionErr(issuerId, "identity", identity.code);
  }

  const candidate: Record<string, unknown> = {
    id: existing.snapshot.id,
    name: identity.name,
    ico: identity.ico,
    address: {
      street: identity.street,
      city: identity.city,
      zip: identity.zip,
      country: "CZ",
    },
    bank: existing.snapshot.bank,
    vatPayer: identity.vatPayer,
    contactEmail: identity.contactEmail,
  };
  if (identity.dic !== undefined) {
    candidate.dic = identity.dic;
  }
  if (identity.registryNote !== undefined) {
    candidate.registryNote = identity.registryNote;
  }
  if (existing.snapshot.logoUrl) {
    candidate.logoUrl = existing.snapshot.logoUrl;
  }
  if (existing.snapshot.stampUrl) {
    candidate.stampUrl = existing.snapshot.stampUrl;
  }
  if (existing.snapshot.signatureUrl) {
    candidate.signatureUrl = existing.snapshot.signatureUrl;
  }
  if (existing.snapshot.paymentQr) {
    candidate.paymentQr = existing.snapshot.paymentQr;
  }

  const finalSnap = IssuerSnapshotSchema.safeParse(candidate);
  if (!finalSnap.success) {
    sectionErr(issuerId, "identity", "snapshot_validation");
  }

  try {
    await withDbTransaction(async (tx) => {
      await tx
        .update(issuerBusinesses)
        .set({
          snapshot: finalSnap.data as Record<string, unknown>,
          source: identity.source,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(issuerBusinesses.id, issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        );
    });
  } catch (err) {
    console.error("[saveIssuerIdentity] failed", err);
    sectionErr(issuerId, "identity", "save_failed");
  }

  revalidateIssuerPaths(issuerId);
  redirect(`/issuers/${issuerId}/edit/identity?toast=issuer_saved`);
}

/** Update bank fields only. */
export async function saveIssuerBank(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const issuerId = optionalTrim(formData.get("id"));
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await loadIssuerSnapshot(workspaceId, issuerId);
  if (!existing) {
    sectionErr(issuerId, "bank", "missing_row");
  }

  const bank = parseBankFromForm(formData);
  if (!bank.ok) {
    sectionErr(issuerId, "bank", bank.code);
  }

  const paymentQr = parsePaymentQrFromForm(formData);
  const candidate: IssuerSnapshot = {
    ...existing.snapshot,
    bank: bank.bank,
  };
  if (paymentQr) {
    candidate.paymentQr = paymentQr;
  } else {
    delete candidate.paymentQr;
  }

  const nextSnapshot = IssuerSnapshotSchema.safeParse(candidate);
  if (!nextSnapshot.success) {
    sectionErr(issuerId, "bank", "snapshot_validation");
  }

  try {
    await withDbTransaction(async (tx) => {
      await tx
        .update(issuerBusinesses)
        .set({
          snapshot: nextSnapshot.data as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(issuerBusinesses.id, issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        );
    });
  } catch (err) {
    console.error("[saveIssuerBank] failed", err);
    sectionErr(issuerId, "bank", "save_failed");
  }

  revalidateIssuerPaths(issuerId);
  redirect(`/issuers/${issuerId}/edit/bank?toast=issuer_saved`);
}

/** Update logo / stamp / signature URLs. */
export async function saveIssuerAssets(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const issuerId = optionalTrim(formData.get("id"));
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await loadIssuerSnapshot(workspaceId, issuerId);
  if (!existing) {
    sectionErr(issuerId, "assets", "missing_row");
  }

  const logoUrl = optionalTrim(formData.get("logoUrl"));
  const stampUrl = optionalTrim(formData.get("stampUrl"));
  const signatureUrl = optionalTrim(formData.get("signatureUrl"));

  const base = { ...existing.snapshot } as IssuerSnapshot & {
    logoUrl?: string;
    stampUrl?: string;
    signatureUrl?: string;
  };
  if (logoUrl) {
    base.logoUrl = logoUrl;
  } else {
    delete base.logoUrl;
  }
  if (stampUrl) {
    base.stampUrl = stampUrl;
  } else {
    delete base.stampUrl;
  }
  if (signatureUrl) {
    base.signatureUrl = signatureUrl;
  } else {
    delete base.signatureUrl;
  }

  const nextSnapshot = IssuerSnapshotSchema.safeParse(base);
  if (!nextSnapshot.success) {
    sectionErr(issuerId, "assets", "snapshot_validation");
  }

  try {
    await withDbTransaction(async (tx) => {
      await tx
        .update(issuerBusinesses)
        .set({
          snapshot: nextSnapshot.data as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(issuerBusinesses.id, issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        );
    });
  } catch (err) {
    console.error("[saveIssuerAssets] failed", err);
    sectionErr(issuerId, "assets", "save_failed");
  }

  revalidateIssuerPaths(issuerId);
  redirect(`/issuers/${issuerId}/edit/assets?toast=issuer_saved`);
}

/** Update numbering schemes for all doc types. */
export async function saveIssuerNumbering(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const issuerId = optionalTrim(formData.get("id"));
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await loadIssuerSnapshot(workspaceId, issuerId);
  if (!existing) {
    sectionErr(issuerId, "numbering", "missing_row");
  }

  try {
    await withDbTransaction(async (tx) => {
      for (const docType of ISSUER_DOC_TYPES) {
        await upsertNumberingScheme(tx, {
          workspaceId,
          issuerId,
          docType,
          formData,
        });
      }
      await tx
        .update(issuerBusinesses)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(issuerBusinesses.id, issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        );
    });
  } catch (err) {
    console.error("[saveIssuerNumbering] failed", err);
    sectionErr(issuerId, "numbering", "save_failed");
  }

  revalidateIssuerPaths(issuerId);
  redirect(`/issuers/${issuerId}/edit/numbering?toast=issuer_saved`);
}

/** Update issuer email defaults (fixes prior FormData wiring gap). */
export async function saveIssuerEmail(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const issuerId = optionalTrim(formData.get("id"));
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await loadIssuerSnapshot(workspaceId, issuerId);
  if (!existing) {
    sectionErr(issuerId, "email", "missing_row");
  }

  const emailSettings = parseEmailSettings(formData);

  try {
    await withDbTransaction(async (tx) => {
      await tx
        .update(issuerBusinesses)
        .set({
          emailSettings,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(issuerBusinesses.id, issuerId),
            eq(issuerBusinesses.workspaceId, workspaceId),
          ),
        );
    });
  } catch (err) {
    console.error("[saveIssuerEmail] failed", err);
    sectionErr(issuerId, "email", "save_failed");
  }

  revalidateIssuerPaths(issuerId);
  redirect(`/issuers/${issuerId}/edit/email?toast=issuer_saved`);
}

/** Mark this issuer as the workspace default for Eve / MCP / AI drafts. */
export async function setDefaultIssuer(formData: FormData): Promise<void> {
  const issuerId = optionalTrim(formData.get("id"));
  const { workspaceId } = await requireWorkspace();
  if (!issuerId) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const existing = await db
    .select({ id: issuerBusinesses.id })
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing[0]) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_row")}`);
  }

  try {
    await withDbTransaction(async (tx) => {
      await assignDefaultIssuer(tx, workspaceId, issuerId);
    });
  } catch (err) {
    console.error("[setDefaultIssuer] failed", err);
    redirect(`/issuers?invalid=${encodeURIComponent("save_failed")}`);
  }

  revalidateIssuerPaths(issuerId);
  const from = optionalTrim(formData.get("from"));
  if (from === "edit") {
    redirect(`/issuers/${issuerId}/edit/identity?toast=issuer_saved`);
  }
  redirect(`/issuers?toast=issuer_saved`);
}

/** Skip first-issuer welcome for this workspace. */
export async function dismissIssuerWelcome(): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  await dismissIssuerWelcomeForWorkspace(workspaceId);
  revalidatePath("/dashboard");
  revalidatePath("/welcome");
  redirect("/dashboard");
}

/** Delete issuer when it has no invoices; cascades numbering schemes. */
export async function deleteIssuer(formData: FormData): Promise<void> {
  const id = optionalTrim(formData.get("id"));
  const { workspaceId } = await requireWorkspace();
  if (!id) {
    redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
  }

  const linked = await withDbTransaction(async (tx) => {
    const found = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(eq(invoices.issuerId, id), eq(invoices.workspaceId, workspaceId)),
      )
      .limit(1);
    if (found[0]) {
      return "has_invoices" as const;
    }
    const templates = await tx
      .select({ id: invoiceTemplates.id })
      .from(invoiceTemplates)
      .where(
        and(
          eq(invoiceTemplates.issuerId, id),
          eq(invoiceTemplates.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (templates[0]) {
      return "has_templates" as const;
    }
    await tx
      .delete(issuerBusinesses)
      .where(
        and(
          eq(issuerBusinesses.id, id),
          eq(issuerBusinesses.workspaceId, workspaceId),
        ),
      );
    const [stillDefault] = await tx
      .select({ id: issuerBusinesses.id })
      .from(issuerBusinesses)
      .where(
        and(
          eq(issuerBusinesses.workspaceId, workspaceId),
          eq(issuerBusinesses.isDefault, true),
        ),
      )
      .limit(1);
    if (!stillDefault) {
      const [next] = await tx
        .select({ id: issuerBusinesses.id })
        .from(issuerBusinesses)
        .where(eq(issuerBusinesses.workspaceId, workspaceId))
        .orderBy(asc(issuerBusinesses.createdAt))
        .limit(1);
      if (next) {
        await tx
          .update(issuerBusinesses)
          .set({ isDefault: true })
          .where(eq(issuerBusinesses.id, next.id));
      }
    }
    return null;
  });

  if (linked) {
    redirect(`/issuers?invalid=${encodeURIComponent(linked)}`);
  }

  revalidateIssuerPaths();
  redirect("/issuers?toast=issuer_deleted");
}

export type WelcomeIssuerDraft = {
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  contactEmail: string;
  vatPayer: boolean;
  accountNumber: string;
  iban: string;
  bic: string;
};

/**
 * Prefill welcome issuer draft from an issued PDF with embedded ISDOC.
 */
export async function parseIssuerFromWelcomePdf(
  formData: FormData,
): Promise<
  { ok: true; draft: WelcomeIssuerDraft } | { ok: false; message: string }
> {
  await requireWorkspace();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Vyberte PDF fakturu." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { ok: false, message: "Nahrajte soubor PDF." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const xml = await extractIsdocFromPdf(bytes);
    if (!xml) {
      return {
        ok: false,
        message:
          "V PDF není vložený ISDOC. Nahrajte fakturu vydanou systémem, který ISDOC embeduje (např. Invoicey / fakturaonline).",
      };
    }
    const parsed = parseIssuerFromIsdoc(xml);
    return {
      ok: true,
      draft: {
        name: parsed.name,
        ico: parsed.ico ?? "",
        dic: parsed.dic ?? "",
        street: parsed.street,
        city: parsed.city,
        zip: parsed.zip,
        contactEmail: parsed.contactEmail ?? "",
        vatPayer: parsed.vatPayer,
        accountNumber: parsed.accountNumber ?? "",
        iban: parsed.iban ?? "",
        bic: parsed.bic ?? "",
      },
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : "parse_failed";
    const map: Record<string, string> = {
      isdoc_missing_invoice_root: "Soubor neobsahuje platný ISDOC doklad.",
      isdoc_missing_supplier: "V ISDOC chybí údaje dodavatele.",
      isdoc_missing_supplier_name: "V ISDOC chybí název dodavatele.",
      isdoc_supplier_not_cz: "Dodavatel musí mít adresu v ČR.",
    };
    return {
      ok: false,
      message: map[code] ?? "Nepodařilo se načíst dodavatele z PDF.",
    };
  }
}
