"use client";

import { useEffect, useState } from "react";

import { renderSpaydPayloadDataUrl } from "@invoicey/invoice-core/look-dom";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { buildSpaydPayload } from "@invoicey/invoice-core/spayd";

export function usePaymentQr(invoice: Invoice | null, enabled: boolean) {
  const payload = enabled && invoice ? buildSpaydPayload(invoice) : null;
  const [image, setImage] = useState<{ payload: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (!payload) {
      setImage(null);
      return;
    }
    let cancelled = false;
    void renderSpaydPayloadDataUrl(payload)
      .then((url) => {
        if (!cancelled) setImage({ payload, url });
      })
      .catch(() => {
        // Payment details remain editable when the browser cannot encode a QR.
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return image?.payload === payload ? image.url : null;
}
