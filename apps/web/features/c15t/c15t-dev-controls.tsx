"use client";

import { Button } from "@/components/ui/button";
import { C15T_CONSENT_STORAGE_KEY } from "@/features/c15t/constants";
import { useConsentManager } from "@c15t/react";

/**
 * Clears c15t storage for local QA.
 */
export function C15tDevControls() {
  const consent = useConsentManager();

  /**
   * Read `NODE_ENV` directly rather than via `env.config.client`. That module
   * validates with Zod, and a single client import of it pulls Zod (plus its
   * whole locale table) into the bundle of every page under `providers.tsx`.
   */
  if (process.env.NODE_ENV === "production") return null;

  return (
    <Button
      className="fixed right-4 bottom-14 z-[100] text-xs text-muted-foreground opacity-40 hover:opacity-100"
      onClick={() => {
        consent.resetConsents();
        try {
          localStorage.removeItem(C15T_CONSENT_STORAGE_KEY);
          localStorage.removeItem("c15t-consent");
        } catch {
          /** ignore */
        }
        document.cookie = `${C15T_CONSENT_STORAGE_KEY}=; path=/; max-age=0`;
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      Reset consent (dev)
    </Button>
  );
}
