"use client";

import * as React from "react";

import type { Invoice } from "@invoicey/invoice-core/schema";

async function fetchDemoPdf(
  invoice: Invoice,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/demo/invoice-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
    signal,
  });
  if (!res.ok) {
    throw new Error(`preview ${String(res.status)}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Watermarked Classic preview; the issued download uses a different route. */
export function useDemoInvoicePreview(
  invoice: Invoice | null,
  error: string | null,
) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const lastKey = React.useRef<string | null>(null);
  const urlRef = React.useRef<string | null>(null);

  const previewKey = invoice ? JSON.stringify(invoice) : null;

  /* oxlint-disable react-doctor/no-fetch-in-effect -- debounce blob preview; abort on change */
  React.useEffect(() => {
    if (error) {
      setPreviewError(error);
      return;
    }
    if (!previewKey || !invoice) {
      return;
    }
    if (previewKey === lastKey.current) {
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setUpdating(true);
      void fetchDemoPdf(invoice, controller.signal)
        .then((nextUrl) => {
          if (controller.signal.aborted) return;
          lastKey.current = previewKey;
          if (urlRef.current && urlRef.current !== nextUrl) {
            URL.revokeObjectURL(urlRef.current);
          }
          urlRef.current = nextUrl;
          setUrl(nextUrl);
          setPreviewError(null);
        })
        /** SAFETY: fetchDemoPdf rejects Error; abort is ignored */
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          if (error.name === "AbortError") return;
          setPreviewError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setUpdating(false);
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [error, invoice, previewKey]);
  /* oxlint-enable react-doctor/no-fetch-in-effect */

  React.useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { url, updating, error: previewError };
}
