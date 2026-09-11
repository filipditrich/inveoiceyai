"use client";

import { useState, useTransition } from "react";
import {
  cancelPocketConnectAction,
  confirmPocketConnectAction,
} from "@/actions/pocket-connect";
import { Button } from "@/components/ui/button";
import { SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function PocketConnectClient(props: {
  canAct: boolean;
  challenge: string;
  deviceName: string | null;
  redirectUri: string;
  workspaces: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("PocketConnect");
  const [pending, startTransition] = useTransition();
  const [workspaceId, setWorkspaceId] = useState(props.workspaces[0]?.id ?? "");

  const confirm = () => {
    if (!props.canAct || !workspaceId) return;
    startTransition(async () => {
      const result = await confirmPocketConnectAction({
        challenge: props.challenge,
        redirectUri: props.redirectUri,
        deviceName: props.deviceName,
        workspaceId,
      });
      if (!result.ok) {
        toast.error(
          result.error === "unavailable" ? t("unavailable") : t("invalid"),
        );
        return;
      }
      window.location.assign(result.redirectTo);
    });
  };

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelPocketConnectAction({
        redirectUri: props.redirectUri,
      });
      if (!result.ok) {
        toast.error(t("invalid"));
        return;
      }
      window.location.assign(result.redirectTo);
    });
  };

  if (!props.canAct) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      <label className="space-y-1.5 text-sm font-medium">
        <span>{t("workspace")}</span>
        <select
          className="h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {props.workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        className="w-full"
        disabled={pending || !workspaceId}
        loading={pending}
        size="lg"
        onClick={confirm}
      >
        <SmartphoneIcon data-icon="inline-start" />
        {pending ? t("confirming") : t("confirm")}
      </Button>
      <Button
        className="w-full"
        disabled={pending}
        variant="ghost"
        onClick={cancel}
      >
        {t("cancel")}
      </Button>
    </div>
  );
}
