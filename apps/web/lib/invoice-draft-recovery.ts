import { z } from "zod";

export type DraftRecoveryContext = { workspaceId: string; issuerId: string };

export type StoredInvoiceDraft<T> = {
  context: DraftRecoveryContext;
  value: T;
};

const recoveryKey = (workspaceId: string) =>
  `invoicey:invoice-draft:${workspaceId}`;
const createSuccessKey = (workspaceId: string) =>
  `invoicey:invoice-draft-create:${workspaceId}`;

const RecoveryAttemptSchema = z.string().uuid();

const RecoveredInvoiceBuilderDraftSchema = z
  .object({
    issuerId: z.string().uuid(),
    clientId: z.string(),
    docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
    issueDate: z.string(),
    dueDate: z.string(),
    duzp: z.string(),
    currency: z.enum(["CZK", "EUR", "USD"]),
    language: z.enum(["cs", "en"]),
    vatMode: z.enum(["regular", "reverse_charge", "oss"]),
    pricesIncludeVat: z.boolean(),
    suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
    legalNote: z.string(),
    localReverseChargeCode: z.string(),
    correctedInvoiceNumber: z.string(),
    notes: z.string(),
    items: z
      .array(
        z.object({
          description: z.string(),
          quantity: z.number().finite(),
          unit: z.string(),
          unitPriceWithoutVat: z.number().finite(),
          vatRate: z.number().finite(),
        }),
      )
      .min(1),
  })
  .strict();

export type RecoveredInvoiceBuilderDraft = z.infer<
  typeof RecoveredInvoiceBuilderDraftSchema
>;

export function normalizeRecoveredInvoiceBuilderDraft(
  value: unknown,
): RecoveredInvoiceBuilderDraft | null {
  const parsed = RecoveredInvoiceBuilderDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function recoveredInvoiceBuilderIssuerIsAvailable(
  draft: RecoveredInvoiceBuilderDraft,
  issuerIds: readonly string[],
): boolean {
  return issuerIds.includes(draft.issuerId);
}

export function isInvoiceDraftRecoveryAttempt(
  value: string | null | undefined,
): value is string {
  return RecoveryAttemptSchema.safeParse(value).success;
}

export function saveRecoveredInvoiceDraft<T>(
  storage: Storage,
  draft: StoredInvoiceDraft<T>,
) {
  storage.setItem(
    recoveryKey(draft.context.workspaceId),
    JSON.stringify(draft),
  );
}

export function loadRecoveredInvoiceDraft<T>(
  storage: Storage,
  context: DraftRecoveryContext,
): T | null {
  const raw = storage.getItem(recoveryKey(context.workspaceId));
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredInvoiceDraft<T>;
    if (stored.context.workspaceId !== context.workspaceId) return null;
    return stored.value;
  } catch {
    storage.removeItem(recoveryKey(context.workspaceId));
    return null;
  }
}

export function clearRecoveredInvoiceDraft(
  storage: Storage,
  workspaceId: string,
) {
  storage.removeItem(recoveryKey(workspaceId));
}

export function markNewInvoiceRecoverySubmission(
  storage: Storage,
  input: { workspaceId: string; attempt: string },
) {
  if (!isInvoiceDraftRecoveryAttempt(input.attempt)) return;
  storage.setItem(createSuccessKey(input.workspaceId), input.attempt);
}

export function consumeNewInvoiceRecoverySubmission(
  storage: Storage,
  input: {
    workspaceId: string;
    attempt: string | null;
    successInvoiceId: string | null | undefined;
    toast: string | null | undefined;
  },
): boolean {
  if (
    !isInvoiceDraftRecoveryAttempt(input.attempt) ||
    !RecoveryAttemptSchema.safeParse(input.successInvoiceId).success ||
    (input.toast !== "invoice_saved" && input.toast !== "invoice_issued")
  ) {
    return false;
  }
  const key = createSuccessKey(input.workspaceId);
  const storedAttempt = storage.getItem(key);
  if (storedAttempt !== input.attempt) return false;
  storage.removeItem(key);
  return true;
}
