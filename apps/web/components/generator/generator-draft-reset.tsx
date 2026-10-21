"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";

export function GeneratorDraftReset({ onReset }: { onReset: () => void }) {
  const t = useTranslations("Generator");
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="sm" />}
      >
        {t("newDraft")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newDraft")}</DialogTitle>
          <DialogDescription>{t("resetDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("keepEditing")}
          </DialogClose>
          <DialogClose
            render={<Button type="button" variant="destructive" />}
            onClick={onReset}
          >
            {t("confirmReset")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
