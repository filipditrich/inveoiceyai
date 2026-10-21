"use client";

import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

import type { ClientSnapshot } from "@invoicey/invoice-core/schema";

type SavedClient = { id: string; snapshot: ClientSnapshot };

export function ClientCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: SavedClient) => void;
}) {
  const t = useTranslations("Clients");
  const common = useTranslations("Common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      >
        <div className="mb-6 space-y-2">
          <DialogTitle>{t("newTitle")}</DialogTitle>
          <DialogDescription>{t("newSubtitle")}</DialogDescription>
        </div>
        <ClientEditorForm
          mode="create"
          onSaved={(client) => {
            onCreated(client);
            onOpenChange(false);
          }}
        />
        <Button
          className="mt-4"
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          {common("cancel")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
