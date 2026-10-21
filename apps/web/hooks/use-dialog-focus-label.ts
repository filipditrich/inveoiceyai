"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

/** Base UI uses focusable button-role guards for Safari/VoiceOver. Keep their
 * focus behavior and give these otherwise empty controls an accessible name. */
export function useDialogFocusLabel() {
  const t = useTranslations("Common");
  const label = t("returnToDialog");
  return useCallback(
    (portal: HTMLDivElement | null) => {
      if (!portal) return;
      const nameGuards = () => {
        for (const guard of portal.querySelectorAll(
          '[data-base-ui-focus-guard][role="button"]',
        )) {
          if (!guard.hasAttribute("aria-label"))
            guard.setAttribute("aria-label", label);
        }
      };
      nameGuards();
      const observer = new MutationObserver(nameGuards);
      observer.observe(portal, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["role"],
      });
      return () => observer.disconnect();
    },
    [label],
  );
}
