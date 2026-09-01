"use client";

import { useEffect } from "react";
import {
  clearRecoveredInvoiceDraft,
  consumeNewInvoiceRecoverySubmission,
} from "@/lib/invoice-draft-recovery";
import {
  emitProductEvent,
  productEventProperties,
  productToastTransitionFromUrl,
  type ProductAnalyticsProperties,
} from "@/lib/product-analytics";

/** Tracks a server-confirmed redirect outcome once while it remains in the URL. */
export function ProductToastTracker({
  toast,
  properties = {},
  clearNewInvoiceRecoveryWorkspaceId,
  successInvoiceId,
}: {
  toast: string | null | undefined;
  properties?: ProductAnalyticsProperties;
  clearNewInvoiceRecoveryWorkspaceId?: string;
  successInvoiceId?: string;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const event = productToastTransitionFromUrl(
      toast,
      url.searchParams.get("toast"),
    );
    if (event) {
      emitProductEvent(event, productEventProperties(event, properties));
      if (
        clearNewInvoiceRecoveryWorkspaceId &&
        consumeNewInvoiceRecoverySubmission(window.sessionStorage, {
          workspaceId: clearNewInvoiceRecoveryWorkspaceId,
          attempt: url.searchParams.get("recoveryAttempt"),
          successInvoiceId,
          toast,
        })
      ) {
        clearRecoveredInvoiceDraft(
          window.sessionStorage,
          clearNewInvoiceRecoveryWorkspaceId,
        );
      }
      url.searchParams.delete("toast");
      url.searchParams.delete("recoveryAttempt");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [clearNewInvoiceRecoveryWorkspaceId, properties, successInvoiceId, toast]);
  return null;
}
