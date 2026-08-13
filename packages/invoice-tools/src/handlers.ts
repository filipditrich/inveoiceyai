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
import { resolveDefaultIssuer } from "./invoice-ops";
import {
  normalizeDraftToInvoice,
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
  };
}
