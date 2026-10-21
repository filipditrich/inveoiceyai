"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("Generator");
  const [url, setUrl] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const controllerRef = React.useRef<AbortController | null>(null);

  const render = React.useCallback(
    async (invoice: Invoice | null): Promise<string | null> => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      if (!invoice) {
        setUpdating(false);
        setPreviewError(t("previewIncomplete"));
        return null;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setUpdating(true);
      setPreviewError(null);
      try {
        const nextUrl = await fetchDemoPdf(
          invoice,
          controller.signal,
          options?.bakeWatermark === true,
        );
        if (controller.signal.aborted) {
          URL.revokeObjectURL(nextUrl);
          return null;
        }
        urlRef.current = nextUrl;
        setUrl(nextUrl);
        return nextUrl;
      } catch {
        if (controller.signal.aborted) return null;
        setPreviewError(t("previewFailed"));
        return null;
      } finally {
        if (!controller.signal.aborted) setUpdating(false);
      }
    },
    [options?.bakeWatermark, t],
  );

  React.useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { url, updating, error: previewError, render };
}
