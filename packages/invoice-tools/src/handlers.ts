import {
  fetchAresEkonomickySubjekt,
  searchAresByObchodniJmeno,
} from "@invoicey/ares";
import { persistDraftInvoice, tryCreateDbFromEnv } from "@invoicey/db";
import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import {
  IssuerSnapshotSchema,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

import { DEMO_ISSUER_ID } from "./demo-issuer";
import { getInvoice, resolveDefaultIssuer } from "./invoice-ops";
import {
  applyLookToDraftWrite,
  loadWorkspaceLookContext,
} from "./look-context";
import {
  normalizeDraftToInvoice,
  type DraftAssumption,
  type NormalizedIssue,
} from "./normalize-draft-invoice";
import { getPreset } from "./presets";
import { resolveWorkspaceId } from "./workspace-context";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMergeDraft(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key];
    if (isRecord(prev) && isRecord(value)) {
      out[key] = deepMergeDraft(prev, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** ARES lookup by IČO. */
export async function lookupBusiness(ico: string) {
  const r = await fetchAresEkonomickySubjekt(ico);
  if (!r.ok) {
    return {
      ok: false as const,
      kind: r.kind,
      message: r.message,
    };
  }
  return { ok: true as const, draft: r.draft };
}

/** ARES search by obchodní jméno (company name). */
export async function searchBusiness(
  query: string,
  options?: { limit?: number },
) {
  const r = await searchAresByObchodniJmeno(query, {
    limit: options?.limit,
  });
  if (!r.ok) {
    return {
      ok: false as const,
      kind: r.kind,
      message: r.message,
    };
  }
  return {
    ok: true as const,
    query: r.query,
    total: r.total,
    matches: r.matches,
  };
}

export type CreateAndRenderResult =
  | {
      ok: true;
      invoice: Invoice;
      pdfBase64: string;
      isdocXml: string;
      filenamePdf: string;
      filenameIsdoc: string;
      invoiceId?: string;
      /** Fields the normalizer filled in — show these before issuing. */
      assumptions: DraftAssumption[];
    }
  | { ok: false; issues: NormalizedIssue[] }
  | { ok: false; error: string };

/** Resolve issuer/template presets, normalize draft, render PDF + ISDOC. */
export async function createAndRenderInvoice(options: {
  draft?: unknown;
  issuerPresetId?: string;
  templatePresetId?: string;
  issuer?: IssuerSnapshot;
  presetsPath?: string;
}): Promise<CreateAndRenderResult> {
  let issuer = options.issuer;

  if (options.issuerPresetId) {
    const loaded = await getPreset({
      id: options.issuerPresetId,
      path: options.presetsPath,
    });
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }
    if (loaded.preset.kind !== "issuer") {
      return {
        ok: false,
        error: `preset ${options.issuerPresetId} is not kind issuer`,
      };
    }
    const parsed = IssuerSnapshotSchema.safeParse(loaded.preset.data);
    if (!parsed.success) {
      return { ok: false, error: "issuer preset data failed validation" };
    }
    issuer = parsed.data;
  }

  if (!issuer) {
    issuer = (await resolveDefaultIssuer()) ?? undefined;
  }
  if (!issuer) {
    return {
      ok: false,
      error:
        "no issuer in this workspace — create one in Invoicey before drafting",
    };
  }

  let draft: unknown = options.draft ?? {};
  if (options.templatePresetId) {
    const loaded = await getPreset({
      id: options.templatePresetId,
      path: options.presetsPath,
    });
    if (!loaded.ok) {
      return { ok: false, error: loaded.error };
    }
    if (loaded.preset.kind !== "invoice_template") {
      return {
        ok: false,
        error: `preset ${options.templatePresetId} is not kind invoice_template`,
      };
    }
    const templateData = loaded.preset.data;
    if (!isRecord(templateData)) {
      return { ok: false, error: "invoice_template data must be an object" };
    }
    const overlay = isRecord(draft) ? draft : {};
    draft = deepMergeDraft(templateData, overlay);
  }

  const normalized = normalizeDraftToInvoice(draft, issuer);
  if (!normalized.ok) {
    return { ok: false, issues: normalized.issues };
  }

  let invoice = normalized.invoice;

  let invoiceId: string | undefined;
  const database = tryCreateDbFromEnv();
  if (database && invoice.issuer.id !== DEMO_ISSUER_ID) {
    try {
      const lookContext = await loadWorkspaceLookContext(
        database,
        resolveWorkspaceId(),
      );
      const withLook = applyLookToDraftWrite(invoice, lookContext);
      if (!withLook.ok) {
        return { ok: false, error: withLook.error };
      }
      invoice = withLook.invoice;
      const persisted = await persistDraftInvoice(database, invoice, {
        workspaceId: resolveWorkspaceId(),
      });
      invoiceId = persisted.invoiceId;
      if (persisted.issuerId !== invoice.issuer.id) {
        invoice = {
          ...invoice,
          issuer: { ...invoice.issuer, id: persisted.issuerId },
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `failed to persist draft invoice: ${message}`,
      };
    }
  }

  const pdfBytes = await renderInvoicePdf(invoice);
  const isdocXml = renderIsdoc(invoice);
  const safeName = invoice.meta.number.replace(/[^\w.-]+/g, "_");

  return {
    ok: true,
    invoice,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    isdocXml,
    filenamePdf: `faktura-${safeName}-isdoc.pdf`,
    filenameIsdoc: `faktura-${safeName}.isdoc`,
    invoiceId,
    assumptions: normalized.assumptions,
  };
}

/**
 * Patch a persisted draft invoice and re-derive everything downstream of the
 * change (VAT, line totals, invoice totals), then write it back in place.
 *
 * The stored draft is turned back into a draft-shaped payload, deep-merged
 * with the patch, and pushed through {@link normalizeDraftToInvoice} again so
 * an edit cannot produce a document the create path would have rejected. The
 * issuer frozen onto the draft is reused rather than re-resolved — the seller
 * is locked at create time and an edit must not silently re-point it.
 */
export type UpdateDraftInvoiceResult =
  | {
      ok: true;
      invoice: Invoice;
      invoiceId: string;
      assumptions: DraftAssumption[];
    }
  | { ok: false; issues: NormalizedIssue[] }
  | { ok: false; error: string };

export async function updateDraftInvoice(options: {
  id: string;
  patch: Record<string, unknown>;
  workspaceId?: string;
}): Promise<UpdateDraftInvoiceResult> {
  const loaded = await getInvoice({
    id: options.id,
    workspaceId: options.workspaceId,
  });
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (loaded.summary.issuedAt && !loaded.summary.cancelledAt) {
    return {
      ok: false,
      error:
        "invoice is already issued — issued invoices are immutable, cancel and re-draft instead",
    };
  }
  const current = loaded.invoice;
  if (!current) {
    return {
      ok: false,
      error: `draft ${options.id} has no readable payload — edit it in the web app`,
    };
  }

  const base: Record<string, unknown> = {
    meta: {
      docType: current.meta.docType,
      number: current.meta.number,
      issueDate: current.meta.issueDate,
      dueDate: current.meta.dueDate,
      duzp: current.meta.duzp,
      language: current.meta.language,
      currency: current.meta.currency,
      correctedInvoiceNumber: current.meta.correctedInvoiceNumber,
    },
    client: current.client,
    vat: current.vat,
    payment: current.payment,
    items: current.items.map((item) => ({
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceWithoutVat: item.unitPriceWithoutVat,
      vatRate: item.vatRate,
    })),
    ...(current.notes === undefined ? {} : { notes: current.notes }),
    ...(current.look === undefined ? {} : { look: current.look }),
    ...(current.appearance === undefined
      ? {}
      : { appearance: current.appearance }),
  };

  /** A patched `items` array replaces the list rather than merging by index. */
  const merged = deepMergeDraft(base, options.patch);
  if (Array.isArray(options.patch.items)) {
    merged.items = options.patch.items;
  }

  const normalized = normalizeDraftToInvoice(merged, current.issuer);
  if (!normalized.ok) return { ok: false, issues: normalized.issues };

  const database = tryCreateDbFromEnv();
  if (!database) {
    return { ok: false, error: "no database configured" };
  }
  try {
    const lookContext = await loadWorkspaceLookContext(
      database,
      resolveWorkspaceId(options.workspaceId),
    );
    const withLook = applyLookToDraftWrite(
      normalized.invoice,
      lookContext,
      current.look,
    );
    if (!withLook.ok) {
      return { ok: false, error: withLook.error };
    }
    await persistDraftInvoice(database, withLook.invoice, {
      workspaceId: resolveWorkspaceId(options.workspaceId),
      invoiceId: options.id,
    });
    return {
      ok: true,
      invoice: withLook.invoice,
      invoiceId: options.id,
      assumptions: normalized.assumptions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `failed to update draft invoice: ${message}` };
  }
}
