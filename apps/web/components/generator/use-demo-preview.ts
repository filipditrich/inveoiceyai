"use client";

import * as React from "react";

import type { Invoice } from "@invoicey/invoice-core/schema";

async function fetchDemoPdf(
  invoice: Invoice,
  signal: AbortSignal,
  bakeWatermark: boolean,
): Promise<string> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (bakeWatermark) {
    headers.set("x-invoicey-locked-preview", "1");
  }
  const res = await fetch("/api/demo/invoice-pdf", {
    method: "POST",
    headers,
    body: JSON.stringify(invoice),
    signal,
  });
  if (!res.ok) {
    throw new Error(`preview ${String(res.status)}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** On-demand Classic PDF. Pass `bakeWatermark` so Open PDF carries PREVIEW. */
export function useDemoInvoicePreview(options?: { bakeWatermark?: boolean }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const controllerRef = React.useRef<AbortController | null>(null);

  const render = React.useCallback(
    (invoice: Invoice | null) => {
      controllerRef.current?.abort();
      if (!invoice) {
        setPreviewError("invoice build failed");
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setUpdating(true);
      setPreviewError(null);
      void fetchDemoPdf(
        invoice,
        controller.signal,
        options?.bakeWatermark === true,
      )
        .then((nextUrl) => {
          if (controller.signal.aborted) return;
          if (urlRef.current && urlRef.current !== nextUrl) {
            URL.revokeObjectURL(urlRef.current);
          }
          urlRef.current = nextUrl;
          setUrl(nextUrl);
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
    },
    [options?.bakeWatermark],
  );

  React.useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { url, updating, error: previewError, render };
}
