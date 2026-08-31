import type { Invoice } from "../schema";
import { appearanceFromCustomization, mergeLookTheme } from "./appearance";
import { findLookDocument, getFirstPartyLook } from "./catalog";
import { CLASSIC_LOOK_1_0_0 } from "./classic";
import {
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  LookDocumentSchema,
  type LookDocument,
} from "./schema";

function classicFallback(): LookDocument {
  return CLASSIC_LOOK_1_0_0;
}

/**
 * Copy a catalog look onto a draft for `renderInvoicePdf`. Issued payloads
 * already carry `lookSnapshot`; this must not run on those — a missing
 * snapshot on an issued invoice means Classic 1.0.0, not the live catalog.
 */
export function withLookSnapshotForRender(
  invoice: Invoice,
  catalog: readonly LookDocument[] = [],
): Invoice {
  const snap = invoice.lookSnapshot
    ? LookDocumentSchema.safeParse(invoice.lookSnapshot)
    : undefined;
  if (snap?.success) return invoice;
  const ref = invoice.look ?? {
    id: CLASSIC_LOOK_ID,
    version: CLASSIC_LOOK_VERSION,
  };
  const document = findLookDocument(ref.id, ref.version, catalog);
  return document ? { ...invoice, lookSnapshot: document } : invoice;
}

/**
 * Snapshot wins; then catalog id+version (first-party, then extra); otherwise
 * Classic 1.0.0. Appearance is merged onto the resolved theme.
 */
export function resolveLookDocument(
  invoice: Invoice,
  catalog: readonly LookDocument[] = [],
): LookDocument {
  const snap = invoice.lookSnapshot
    ? LookDocumentSchema.safeParse(invoice.lookSnapshot)
    : undefined;
  const base = snap?.success
    ? snap.data
    : invoice.look
      ? (findLookDocument(invoice.look.id, invoice.look.version, catalog) ??
        classicFallback())
      : (getFirstPartyLook(CLASSIC_LOOK_ID, CLASSIC_LOOK_VERSION) ??
        classicFallback());

  const fromCustomization =
    invoice.appearance === undefined && invoice.customization
      ? appearanceFromCustomization(invoice.customization)
      : undefined;
  const appearance = invoice.appearance ?? fromCustomization;
  return {
    ...base,
    theme: mergeLookTheme(base.theme, appearance),
  };
}
