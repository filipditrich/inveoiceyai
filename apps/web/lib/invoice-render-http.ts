import type { InvoiceRenderRequestResult } from "@invoicey/invoice-core";

export type InvoiceRenderErrorBody =
  | { error: "empty" | "invalid_shape" | "unauthorized" | "pdf_render_failed" }
  | { error: "too_many"; limit: number; count: number }
  | {
      error: "validation_failed";
      issues: Extract<
        InvoiceRenderRequestResult,
        { error: "validation_failed" }
      >["issues"];
    }
  | { error: "invalid_look"; detail: string };

type FailedParse = Extract<InvoiceRenderRequestResult, { ok: false }>;

export type InvoiceRenderHttpError = {
  status: number;
  body: InvoiceRenderErrorBody;
};

export function invoiceRenderParseError(
  result: FailedParse,
): InvoiceRenderHttpError {
  if (result.error === "too_many") {
    return {
      status: 413,
      body: {
        error: "too_many",
        limit: result.limit,
        count: result.count,
      },
    };
  }
  if (result.error === "validation_failed") {
    return {
      status: 422,
      body: { error: "validation_failed", issues: result.issues },
    };
  }
  return { status: 400, body: { error: result.error } };
}
