import type { Invoice } from "../schema";
import { appearanceFromCustomization, mergeLookTheme } from "./appearance";
import { getFirstPartyLook } from "./catalog";
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
 * Snapshot wins; then catalog id+version; otherwise Classic 1.0.0.
 * Appearance is merged onto the resolved theme.
 */
export function resolveLookDocument(invoice: Invoice): LookDocument {
  const snap = invoice.lookSnapshot
    ? LookDocumentSchema.safeParse(invoice.lookSnapshot)
    : undefined;
  const base = snap?.success
    ? snap.data
    : invoice.look
      ? (getFirstPartyLook(invoice.look.id, invoice.look.version) ??
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
