"use client";

import { useState, useTransition } from "react";
import {
  cancelDriveConnectAction,
  confirmDriveConnectAction,
} from "@/actions/drive-connect";
import { Button } from "@/components/ui/button";
import { LaptopIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function DriveConnectClient({
  canAct,
  challenge,
  deviceName,
  redirectUri,
}: {
  canAct: boolean;
  challenge: string;
  deviceName: string | null;
  redirectUri: string;
}) {
  const t = useTranslations("DriveConnect");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const go = (redirectTo: string) => {
    window.location.assign(redirectTo);
  };

  const confirm = () => {
    if (!canAct) return;
    startTransition(async () => {
      const result = await confirmDriveConnectAction({
        challenge,
        redirectUri,
        deviceName,
      });
      if (!result.ok) {
        toast.error(
          result.error === "unavailable" ? t("unavailable") : t("invalid"),
        );
        return;
      }
      setDone(true);
      go(result.redirectTo);
    });
  };

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelDriveConnectAction({ redirectUri });
      if (!result.ok) {
        toast.error(t("invalid"));
        return;
      }
      go(result.redirectTo);
    });
  };

  if (!canAct) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        className="w-full"
        disabled={done || pending}
        loading={pending}
        size="lg"
        onClick={confirm}
      >
        <LaptopIcon data-icon="inline-start" />
        {done ? t("confirmed") : pending ? t("confirming") : t("confirm")}
      </Button>
      <Button
        className="w-full"
        disabled={pending || done}
        variant="ghost"
        onClick={cancel}
      >
        {t("cancel")}
      </Button>
    </div>
  );
}
