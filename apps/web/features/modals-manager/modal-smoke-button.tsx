"use client";

import { Button } from "@/components/ui/button";
import { IS_LOCAL_DEV } from "@/env.config.client";
import { openModal } from "@/features/modals-manager/events";

import type { ModalsProviderContextProps } from "@/features/modals-manager/modal-types";

/** Dev smoke: CustomEvent openModal → ModalShell. */
export function ModalSmokeButton() {
  if (!IS_LOCAL_DEV) return null;

  return (
    <Button
      className="text-xs text-muted-foreground"
      onClick={() => {
        openModal({
          mode: "dialog",
          children: ({ ctx }) => {
            const modalsCtx = ctx as ModalsProviderContextProps;
            return (
              <div className="p-6">
                <p className="font-medium text-foreground">
                  Globální modální systém OK
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Zavřením vrstvy nebo tlačítkem zkontrolujte animaci uzavření.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => modalsCtx.closeAll()}
                >
                  Zavřít všechny ({modalsCtx.modals.length})
                </Button>
              </div>
            );
          },
        });
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      Modals demo
    </Button>
  );
}
