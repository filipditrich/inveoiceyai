import { z } from "zod";

export type GuestIssueSuccess = {
  ok: true;
  invoiceId: string;
  number: string;
  downloadUrl: string;
  mailed: boolean;
};

export type GuestIssueErrorKey =
  | "errorBot"
  | "errorRate"
  | "errorEmail"
  | "errorDisposable"
  | "errorUndeliverable"
  | "errorAllowance"
  | "errorInvoice"
  | "errorUnavailable";

export type GuestIssueClientResult =
  | GuestIssueSuccess
  | { ok: false; errorKey: GuestIssueErrorKey };

const SuccessSchema = z.object({
  ok: z.literal(true),
  invoiceId: z.string().min(1),
  number: z.string().min(1),
  downloadUrl: z.string().min(1),
  mailed: z.boolean().optional(),
});

const ErrorSchema = z.object({
  error: z.string().min(1),
});

function errorKeyForCode(code: string): GuestIssueErrorKey {
  switch (code) {
    case "bot":
      return "errorBot";
    case "rate_limited":
      return "errorRate";
    case "invalid_email":
      return "errorEmail";
    case "disposable_email":
      return "errorDisposable";
    case "undeliverable_email":
      return "errorUndeliverable";
    case "allowance_exhausted":
      return "errorAllowance";
    case "invoice_invalid":
    case "payload_too_large":
      return "errorInvoice";
    default:
      return "errorUnavailable";
  }
}

function errorKeyForStatus(status: number): GuestIssueErrorKey {
  if (status === 403) return "errorBot";
  if (status === 429) return "errorRate";
  if (status === 413 || status === 422) return "errorInvoice";
  return "errorUnavailable";
}

/** Map the issue endpoint's JSON (or a failed parse) onto gate copy keys. */
export function parseIssueResponse(
  status: number,
  /* oxlint-disable-next-line anti-slop/no-unknown-parameters -- Zod parses the JSON body below */
  body: unknown,
): GuestIssueClientResult {
  const success = SuccessSchema.safeParse(body);
  if (status === 200 && success.success) {
    return {
      ok: true,
      invoiceId: success.data.invoiceId,
      number: success.data.number,
      downloadUrl: success.data.downloadUrl,
      mailed: success.data.mailed === true,
    };
  }

  const failure = ErrorSchema.safeParse(body);
  if (failure.success) {
    return { ok: false, errorKey: errorKeyForCode(failure.data.error) };
  }

  return { ok: false, errorKey: errorKeyForStatus(status) };
}
