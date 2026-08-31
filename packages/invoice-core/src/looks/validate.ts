import type { Invoice } from "../schema";
import {
  REQUIRED_LOOK_BLOCKS,
  type BlockInstance,
  type LookBlockId,
  type LookDocument,
} from "./schema";

export type LookValidationIssue = {
  readonly path: string;
  readonly message: string;
};

function instanceKey(slot: BlockInstance): string {
  return `${slot.block}:${slot.variant ?? "full"}`;
}

function collectSlots(look: LookDocument): BlockInstance[] {
  const slots: BlockInstance[] = [];
  for (const band of look.layout.bands) {
    if (band.type === "stack" || band.type === "footer") {
      slots.push(...band.slots);
    } else {
      slots.push(...band.start, ...band.end);
    }
  }
  return slots;
}

/** Structural rules that do not depend on a particular invoice. */
export function validateLookDocument(
  look: LookDocument,
): LookValidationIssue[] {
  const issues: LookValidationIssue[] = [];
  const bands = look.layout.bands;
  const footerIndexes = bands
    .map((band, index) => (band.type === "footer" ? index : -1))
    .filter((index) => index >= 0);

  if (footerIndexes.length !== 1) {
    issues.push({
      path: "layout.bands",
      message: "look must have exactly one footer band",
    });
  } else if (footerIndexes[0] !== bands.length - 1) {
    issues.push({
      path: "layout.bands",
      message: "footer band must be last",
    });
  }

  const slots = collectSlots(look);
  const seen = new Map<string, LookBlockId>();
  const typeVariants = new Map<LookBlockId, Set<string>>();

  for (const slot of slots) {
    const variant = slot.variant ?? "full";
    if (variant === "compact" && slot.block !== "payment") {
      issues.push({
        path: `slots.${slot.block}`,
        message: "compact variant is only allowed on payment",
      });
    }
    const key = instanceKey(slot);
    if (seen.has(key)) {
      issues.push({
        path: `slots.${key}`,
        message: "block instance may appear at most once",
      });
    }
    seen.set(key, slot.block);
    const variants = typeVariants.get(slot.block) ?? new Set();
    variants.add(variant);
    typeVariants.set(slot.block, variants);
  }

  for (const [block, variants] of typeVariants) {
    if (variants.size > 1 && block !== "payment") {
      issues.push({
        path: `slots.${block}`,
        message: "only payment may appear with differing variants",
      });
    }
  }

  const placed = new Set(slots.map((slot) => slot.block));
  for (const block of REQUIRED_LOOK_BLOCKS) {
    if (!placed.has(block)) {
      issues.push({
        path: `slots.${block}`,
        message: `required block ${block} is missing`,
      });
    }
  }

  return issues;
}

function hasPaymentSlot(look: LookDocument): boolean {
  return collectSlots(look).some((slot) => slot.block === "payment");
}

/** Required blocks for this invoice; optional blocks may be absent. */
export function validateLookForInvoice(
  look: LookDocument,
  invoice: Invoice,
): LookValidationIssue[] {
  const issues = validateLookDocument(look);
  if (invoice.payment.method === "transfer" && !hasPaymentSlot(look)) {
    issues.push({
      path: "slots.payment",
      message: "transfer invoices require a payment block",
    });
  }
  return issues;
}

export function lookDocumentIsValid(look: LookDocument): boolean {
  return validateLookDocument(look).length === 0;
}
