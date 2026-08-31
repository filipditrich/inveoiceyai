import type { Invoice } from "../schema";
import { canApplyLook, getFirstPartyLook } from "./catalog";
import {
  CLASSIC_LOOK_ID,
  CLASSIC_LOOK_VERSION,
  type LookDocument,
  type LookRef,
} from "./schema";
import { validateLookForInvoice } from "./validate";

export function defaultLookRef(): LookRef {
  return { id: CLASSIC_LOOK_ID, version: CLASSIC_LOOK_VERSION };
}

export function withoutLookSnapshot(invoice: Invoice): Invoice {
  if (!invoice.lookSnapshot) return invoice;
  const { lookSnapshot: _removed, ...rest } = invoice;
  return rest;
}

export function lookRefForNewDraft(
  apply: "classic" | "catalog",
  requested?: LookRef,
  workspaceDefault?: LookRef,
): LookRef {
  const candidate = requested ?? workspaceDefault ?? defaultLookRef();
  if (!canApplyLook(apply, candidate.id)) {
    return defaultLookRef();
  }
  if (!getFirstPartyLook(candidate.id, candidate.version)) {
    return defaultLookRef();
  }
  return candidate;
}

/**
 * Draft writes. A locked look already on the row is kept (downgrade); picking
 * a new unauthorized look is refused. Missing look inherits the workspace
 * default when that default is entitled.
 */
export function resolveDraftLookRef(
  apply: "classic" | "catalog",
  requested: LookRef | undefined,
  options?: { existing?: LookRef; workspaceDefault?: LookRef },
):
  | { ok: true; look: LookRef }
  | { ok: false; error: "look_not_entitled" | "invalid_look" } {
  if (!requested) {
    return {
      ok: true,
      look: lookRefForNewDraft(apply, undefined, options?.workspaceDefault),
    };
  }
  if (!getFirstPartyLook(requested.id, requested.version)) {
    return { ok: false, error: "invalid_look" };
  }
  if (canApplyLook(apply, requested.id)) {
    return { ok: true, look: requested };
  }
  const existing = options?.existing;
  if (
    existing &&
    existing.id === requested.id &&
    existing.version === requested.version
  ) {
    return { ok: true, look: requested };
  }
  return { ok: false, error: "look_not_entitled" };
}

export function attachLookSnapshot(
  invoice: Invoice,
  apply: "classic" | "catalog",
):
  | { ok: true; invoice: Invoice }
  | { ok: false; error: "look_not_entitled" | "invalid_look" } {
  const requested = invoice.look ?? defaultLookRef();
  if (!canApplyLook(apply, requested.id)) {
    return { ok: false, error: "look_not_entitled" };
  }
  const document: LookDocument | undefined = getFirstPartyLook(
    requested.id,
    requested.version,
  );
  if (!document) {
    return { ok: false, error: "invalid_look" };
  }
  const next: Invoice = {
    ...invoice,
    look: requested,
    lookSnapshot: document,
  };
  if (validateLookForInvoice(document, next).length > 0) {
    return { ok: false, error: "invalid_look" };
  }
  return { ok: true, invoice: next };
}
